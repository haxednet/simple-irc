/*
	simple-irc: IRC socket wrapper class for node.js by Matthew Ryan www.haxed.net
	version: 1.0.3
	License: MIT
	
*/

const net = require( 'net' );
const E = require( './enums.json' );

function irc( e ){
	if( !e ) return { authType: { none: 0, nickServ: 1, saslPlain: 2 } };
	
	if( !e.server || !e.server.address ) throw("invalid or missing server information");
	
	if( !e.userInfo || !e.userInfo.nick ) throw("invalid or missing user information");
	
	if( E.RPL_WELCOME == undefined ) throw("failed to load enumerators from enums.json");
	
	e.userInfo.username = e.userInfo.username || "default";
	e.userInfo.auth = e.userInfo.auth || { type: 0 };
	e.server.port = e.server.port || 6667;
	
	this.server = e.server;
	this.userInfo = e.userInfo;
	this.channels = e.channels || [];
	this.options = e;
	this.connected = false;
	this.channelJoinDelay = 5000;
	
	this.cache = ""; /* temp package storage, unless we get all the data */
	
	this.onConnect = function( e ){};
	this.onDisconnect = function( e ){ throw("Disconnected from IRC"); };
	this.onData = function( e ){};
	this.onPrivmsg = function( e ){};
	this.onNotice = function( e ){};
	this.onNumeric = function( e ){}; 
	this.onNickChanged = function( e ){};
	this.onModeChanged = function( e ){};
	this.onConnected = function( e ){};
	this.onChannelJoined = function( e ){};
	this.onChannelLeft = function( e ){};
	this.onChannelTopicChanged = function( e ){};
	
	this.onUserJoined = function( e ){};
	this.onUserLeft = function( e ){};
	this.onUserQuit = function( e ){};
	this.onUserKicked = function( e ){};
	
	
	this.onError = function( e ){
		throw( "Uncaught error: " + e.message );
	};
	this.onProtocolError = function( e ){
		console.log( "IRC Protocol Error: " + e.code + " " + e.message );
	};
	
	this.callbackState = {
		/*
			used when hold data while waiting to execute a callback
			state 0 = nothing
			state 1 = waiting for ban list
		*/
		state: 0,
		callback: function(){},
		cache: ""
	}
	
	const me = this;
	
	this.pingTimer = setInterval(function(){
		/* ping the server every 30 seconds */
		me.sendData( "PING :hello" );
	}, 30000);
	
	
	this.channelInfo = {
		'*fake_sample_chan':{
				topic: 'Project is dead. Thanks google',
				users: [ 'roar', 'Time-Warp', 'duckgoose' ]
			}
	 };
	
	this.serverOptions = {
		channelModes: [ "b", "k", "l", "imnpstr" ],
		prefix: [ "ov", "@+" ],
		chanTypes: [ "#" ]
	};
	
	/* now lets make a tcp socket */
	this.client = new net.Socket();
	this.client.connect(e.server.port, e.server.address, function() {
		me.connected = true;
		me.onConnect();
		/* let's register */
		if( me.server.password ) me.sendData( "PASS :" + me.server.password );
		if( me.userInfo.auth.type == 2 ) me.sendData( "CAP REQ :sasl" );
		me.sendData( "NICK " + me.userInfo.nick );
		me.sendData( "USER " + me.userInfo.username + " * * :" + me.userInfo.username  );
	});
	this.client.on('data', function(data) {
		me.cache += data.toString().replace( /\r/i, "" );
		if( me.cache.substr(me.cache.length - 1) == "\n" ) {
			const databits = me.cache.split( "\n" );
			for( let i in databits ) {
				if( databits[i].length > 0 ){
					me.onData({ data: databits[i] });
					me.parseData( databits[i] );
				}
			}
			me.cache = "";
		}
	});
	this.client.on('close', function(e) {
		if( me.connected ) me.onDisconnect({ code: 0, message: "socket closed" });
		me.connected = false;
		this.channelInfo = {};
	});
	this.client.on('error', function(e) {
		me.onDisconnect({ code: 2, message: e.code });
		me.connected = false;
		this.channelInfo = {};
	});
}

irc.prototype.quit = function(e){
	this.sendData( "QUIT :" + e );
}

irc.prototype.setModes = function( e ){
	/* irc.setMode({ for: "#channel", modes: [{state: "add", mode: "b", value: "*!*@*"}] } }); */
	const str = "MODE " + e.for + " ";
	let amodes = ""; /* modes to add */
	let rmodes = ""; /* modes to remove */
	let vals = ""; /* mode values */
	for( let i in e.modes ) {
		const m = e.modes[i]; /* working mode */
		if(m.state == "add"){
			if( amodes == "" ) amodes = "+";
			amodes +=  m.mode;
		}else{
			if( rmodes == "" ) rmodes = "-";
			rmodes +=  m.mode;
		}
		if( m.value != undefined ) vals += (" " + m.value);
	}
	this.sendData( str + amodes + rmodes + vals );
}

irc.prototype.parseData = function( e ){
	e = e.replace( /(\r|\n)/g, "" );
	if( e.substr(0,1) != ":" ) e = ":server " + e;
	let bits = e.split( " " );
	let cMsg = ""; /* holds a message that follows a colon */
	let rt = ""; /* holds the user or channel to reply to */
	let tmpObj = "";
	const me = this;
	if( bits.length > 2 ) {
	
		if( e.indexOf(" :") > 1 ) cMsg = e.substr( e.indexOf( " :" ) + 2 );
		
		if( !isNaN( parseInt( bits[1] ) ) ) {
			/* it's a numeric ! */
			this.onNumeric( { number: parseInt( bits[1] ), data: e } );
		}
		
		for( let i in E ){
			if( E[i] == bits[1] ) {
				if( i.substr( 0, 4 ) == "ERR_" ) this.onProtocolError({ code: parseInt( E[i] ), message: i, data: e });
			}
		}
		
		switch( bits[1].toUpperCase() ) {
			
			case E.RPL_WELCOME:
				this.onConnected();
				if( this.userInfo.auth.type == 1 ) this.sendData( "NICKSERV IDENTIFY " + this.userInfo.auth.user + " " + this.userInfo.auth.password );
				
				/* we put channel joining on a delay to give time for nickserv to log us in */
				setTimeout(function(){ 
					let tj = [];
					if( me.channels.length > 0 ) {
						for(let i in me.channels){
							let cstr = me.channels[i].name;
							if( me.channels[i].key ) cstr += " " + me.channels[i].key;
							tj.push( cstr );
							if( tj.length == 10 ) {
								me.sendData( "JOIN " + tj.toString() );
								tj = [];
							}
						}
						me.sendData( "JOIN " + tj.toString() );
					}
				}, this.channelJoinDelay);

				break;
				
			case E.RPL_SASL_AUTH:
				if( this.userInfo.auth.type == 2 ) this.sendData( "CAP END" );
				break;
				
			case E.ERR_SASL_AUTH:
				this.onError({ message: "ERR_SASL_AUTH_FAIL" });
				break;
			case E.RPL_TOPIC:
				/* channel topic */
				this.channelInfo[ bits[3].toLowerCase() ].topic = cMsg;
				break;
				
			case E.RPL_NAMREPLY:
				/* channel user list */
				let chanUsers = cMsg.split( " " );
				for( let i in chanUsers ) {
					this.channelInfo[ bits[4].toLowerCase() ].users.push( removeUserPrefix( chanUsers[i] ) );
				}
				break;
				
			case E.RPL_BANLIST:
				
				if( this.callbackState.state == 1 ){
					this.callbackState.cache += e + "\n"
				}
				break;
				
			case E.RPL_ENDOFBANLIST:
				if( this.callbackState.state == 1 ){
					const bld = this.callbackState.cache.split("\n");
					
					const returnObj = [];
					for( let i in bld ){
						if(bld[i].length > 1){
							let s = bld[i].split(" ");
							returnObj.push({ mask: s[4], setter: s[5], time: s[6] });
						}
					}
					this.callbackState.state = 0;
					this.callbackState.callback( returnObj );
					this.callbackState.callback = null;
					this.callbackState.cache = "";
				}
				break;
			
			case "CAP":
				if( this.userInfo.auth.type == 2 && bits[3] == "ACK" && bits[4] == ":sasl" ) {
					this.sendData( "AUTHENTICATE PLAIN" );
				}
				break;
				
			case "AUTHENTICATE":
				let at = new Buffer(this.userInfo.auth.user + String.fromCharCode(0) + this.userInfo.auth.user + String.fromCharCode(0) + this.userInfo.auth.password).toString('base64');
				this.sendData( "AUTHENTICATE " + at );
				break;
			
			case "JOIN":
				bits[2] = bits[2].replace(":", ""); /* some servers add ":" before channel names, some don't */
				if( parseUser( bits[0] ).nick.toLowerCase() == this.userInfo.nick.toLowerCase() ){
					this.onChannelJoined( { channel: bits[2] } );
					this.channelInfo[ bits[2].toLowerCase() ] = { topic: "", users: [] };
				}else{
					rt = bits[2]; /* who to reply to */
					this.onUserJoined( { channel: bits[2], user: parseUser( bits[0] ).nick, reply: reply, userInfo: parseUser( bits[0] ) } );
					this.channelInfo[ bits[2].toLowerCase() ].users.push( parseUser( bits[0] ).nick );
					
				}
				break;
				
			case "PART":
				bits[2] = bits[2].replace(":", ""); /* some servers add ":" before channel names, some don't */
				if( parseUser( bits[0] ).nick.toLowerCase() == this.userInfo.nick.toLowerCase() ){
					this.onChannelLeft( { channel: bits[2] } );
					this.channelInfo[ bits[2].toLowerCase() ] = undefined;
				}else{
					this.onUserLeft( { channel: bits[2], user: parseUser( bits[0] ).nick, message: cMsg, userInfo: parseUser( bits[0] ) } );
					let usersObj = this.channelInfo[ bits[2].toLowerCase() ].users;
					for( let i in usersObj ) {
						if( usersObj[i].toLowerCase() ==  parseUser( bits[0] ).nick.toLowerCase() ) {
							usersObj.splice( i, 1 );
						}
					}
				}
				break;
				
			case "QUIT":
				if( parseUser( bits[0] ).nick == this.userInfo.nick ){
					this.connected = false;
					this.client.close();
					this.onDisconnect({ code: 1, message: "quit from server" });
					this.channelInfo = {};
				}else{
					this.onUserQuit( { user: parseUser( bits[0] ).nick, message: cMsg, userInfo: parseUser( bits[0] ) } );
					for( let i in this.channelInfo ) {
						for( let a in this.channelInfo[i].users ) {
							if( this.channelInfo[i].users[a].toLowerCase() == parseUser( bits[0] ).nick.toLowerCase() ) {
								this.channelInfo[i].users.splice( a, 1 );
							}
						}
					}
				}
				break;
			case "KICK":
				this.onUserKicked({ channel: bits[2], user: bits[3], kicker: parseUser( bits[0] ).nick, reason: cMsg });
				break;
			case "MODE":
				const modeObj = {
					for: bits[2],
					modes: []
				};
				
				const modeStr = e.substr( bits[0].length + bits[1].length + bits[2].length + 3 );
				const modes = modeStr.split( " " )[0].split( "" );
				const vals = modeStr.split( " " );
				vals.splice( 0, 1 );
				
				let wv = "add"; /* working value for a mode */
				
				for( let i in modes ){
					if( modes[i] == "+" ){
						wv = "add";
					}else if( modes[i] == ":" ){
					}else if( modes[i] == "-" ){
						wv = "remove";
					}else{
						let mVal = "";
						if( vals.length > 0 && (this.serverOptions.channelModes[0].indexOf( modes[i] ) > -1 || this.serverOptions.channelModes[1].indexOf( modes[i] ) > -1 || this.serverOptions.prefix[0].indexOf( modes[i] ) > -1) ){
							mVal = vals[0];
							vals.splice( 0, 1 );
						}
						modeObj.modes.push({ state: wv, mode: modes[i], value: mVal });
					}
				}
				
				this.onModeChanged( modeObj );
				break;
			case "NICK":
				this.onNickChanged({ old: parseUser( bits[0] ).nick, new: bits[2].replace( ":", "" ) });
				if( parseUser( bits[0] ).nick.toLowerCase() == this.userInfo.nick.toLowerCase() ){
					/* it's us! let's update our nick */
					this.userInfo.nick = bits[2].replace( ":", "" );
				}
				break;
			case "NOTICE":
				rt = parseUser( bits[0] ); /* who to reply to */
				if( isChannel( bits[2] ) ) rt = bits[2];
				this.onNotice({ from: rt.nick, to: removeUserPrefix( bits[2] ), message: cMsg, toChannel: isChannel( bits[2] ), reply: reply, userInfo: rt  });
				break;
				
			case "PRIVMSG":
				rt = parseUser( bits[0] ).nick; /* who to reply to */
				if( isChannel( bits[2] ) ) rt = bits[2];
				this.onPrivmsg({ from: parseUser( bits[0] ).nick, to: removeUserPrefix( bits[2] ), message: cMsg, toChannel: isChannel( bits[2] ), reply: reply, userInfo: parseUser( bits[0] )  });
				break;
				
			case "PING":
				this.sendData( "PONG " + bits[2] );
				break;
				
			case "TOPIC":
				this.onChannelTopicChanged({
					user: parseUser( bits[0] ),
					channel: bits[2],
					topic: cMsg
				});
				this.channelInfo[ bits[2].toLowerCase() ].topic = cMsg;
				break;
		}
	
	}
	
	function parseUser( e ) {
		e = e.replace( ":", "" );
		var a = e.replace( "@", "!" ).split( "!" );
		return { nick: a[0], ident: a[1], host: a[2], fullString: e };
	}
	
	function isChannel( e ) {
		e = removeUserPrefix( e );
		for( let i in me.serverOptions.chanTypes ) {
			if( e.substr( 0, 1 ) == me.serverOptions.chanTypes[i] ) return true;
		}
		return false;
	}
	
	function removeUserPrefix( e ){
		const p = me.serverOptions.prefix[1].split( "" );
		for( let i in p ) {
			if( e.substr( 0, 1 ) == p[i] ) e = e.substr(1);
		}
		return e;
	}
	
	function reply( e ) {
		me.sendMessage({ to: rt, message: e })
	}
}



irc.prototype.sendData = function( e ){
	this.client.write( e + "\r\n" );
}
irc.prototype.sendMessage = function( e ){
	/* irc.sendMessage({ to: "Jesus", message: "hey" }); */
	this.sendData( "PRIVMSG " + e.to + " :" + e.message );
}
irc.prototype.sendNotice = function( e ){
	/* irc.sendNotice({ to: "Jesus", message: "hey" }); */
	this.sendData( "NOTICE " + e.to + " :" + e.message );
}
irc.prototype.joinChannel = function( e ){
	/* irc.joinChannel({ channel: "#channel", key: "secret" }) */
	if( e.key == undefined ) e.key = "";
	this.sendData( "JOIN " + e.channel );
}
irc.prototype.leaveChannel = function( e ){
	/* irc.leaveChannel({ channel: "#channel", message: "bye" }) */
	if( e.message == undefined ) e.message = "bye";
	this.sendData( "PART " + e.channel + " :" + e.message );
}
irc.prototype.kickUser = function( e ){
	/* irc.kickUser({ channel: "#channel", nick: "badguy", message: "bye" }) */
	if( e.message == undefined ) e.message = e.nick;
	this.sendData( "KICK " + e.channel + " " + e.nick + " :" + e.message );
}
irc.prototype.inviteUser = function( e ){
	/* irc.inviteUser({ channel: "#channel", nick: "badguy" }) */
	this.sendData( "INVITE " + e.nick + " " + e.channel );
}
irc.prototype.setTopic = function( e ){
	/* irc.setTopic({ channel: "#channel", topic: "hey" }) */
	this.sendData( "TOPIC " + e.channel + " :" + e.topic );
}
irc.prototype.getChannelUsers = function( e ){
	/* irc.getChannelUsers({ channel: "#channel" }) */
	if( this.channelInfo[e.channel] == undefined ) return [];
	return this.channelInfo[e.channel].users;
}
irc.prototype.getChannelTopic = function( e ){
	/* irc.getChannelTopic({ channel: "#channel" }) */
	if( this.channelInfo[e.channel] == undefined ) return "";
	return this.channelInfo[e.channel].topic;
}
irc.prototype.getChannelBanList = function( e ){
	/* irc.getChannelBanList({ channel: "#channel", callback: function(e){} }) */
	this.callbackState.state = 1;
	this.callbackState.callback = e.callback;
	this.sendData( "MODE " + e.channel + " +b" );
}




module.exports = irc;
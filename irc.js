/*
	irc.js: IRC class by Matthew Ryan www.haxed.net
	version: 1.0.2
	License: MIT
	
*/

const net = require( 'net' );

function irc( e ){
	if( !e ) return { authType: { none: 0, nickServ: 1, saslPlain: 2 } };
	
	if( !e.server || !e.server.address || !e.server.port ) throw("invalid or missing server information");
	
	if( !e.userInfo || !e.userInfo.nick ) throw("invalid or missing user information");
	
	e.userInfo.username = e.userInfo.username || "default";
	e.userInfo.auth = e.userInfo.auth || { type: "none" };
	
	
	this.server = e.server;
	this.userInfo = e.userInfo;
	this.channels = e.channels || [];
	this.options = e;
	this.connected = false;
	this.channelJoinDelay = 5000;
	
	this.cache = ""; /* a place to store data until we need it */
	
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
		throw( "Uncaught error:" + e.message );
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
		me.sendData( "PING :hello" );
	}, 30000);
	
	
	this.channelInfo = {
		'#burd':{
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
	/* irc.getChannelList({ channel: "#channel", callback: function(e){} }) */
	this.callbackState.state = 1;
	this.callbackState.callback = e.callback;
	this.sendData( "MODE " + e.channel + " +b" );
}




const E = {
	"RPL_WELCOME": "001",
	"RPL_YOURHOST": "002",
	"RPL_CREATED": "003",
	"RPL_MYINFO": "004",
	"RPL_ISUPPORT": "005",
	"RPL_SNOMASK": "008",
	"RPL_STATMEMTOT": "009",
	"RPL_BOUNCE": "010",
	"RPL_YOURCOOKIE": "014",
	"RPL_YOURID": "042",
	"RPL_SAVENICK": "043",
	"RPL_ATTEMPTINGJUNC": "050",
	"RPL_ATTEMPTINGREROUTE": "051",
	"RPL_TRACELINK": "200",
	"RPL_TRACECONNECTING": "201",
	"RPL_TRACEHANDSHAKE": "202",
	"RPL_TRACEUNKNOWN": "203",
	"RPL_TRACEOPERATOR": "204",
	"RPL_TRACEUSER": "205",
	"RPL_TRACESERVER": "206",
	"RPL_TRACESERVICE": "207",
	"RPL_TRACENEWTYPE": "208",
	"RPL_TRACECLASS": "209",
	"RPL_STATS": "210",
	"RPL_STATSLINKINFO": "211",
	"RPL_STATSCOMMANDS": "212",
	"RPL_STATSCLINE": "213",
	"RPL_STATSILINE": "215",
	"RPL_STATSKLINE": "216",
	"RPL_STATSYLINE": "218",
	"RPL_ENDOFSTATS": "219",
	"RPL_UMODEIS": "221",
	"RPL_SERVLIST": "234",
	"RPL_SERVLISTEND": "235",
	"RPL_STATSVERBOSE": "236",
	"RPL_STATSENGINE": "237",
	"RPL_STATSIAUTH": "239",
	"RPL_STATSLLINE": "241",
	"RPL_STATSUPTIME": "242",
	"RPL_STATSOLINE": "243",
	"RPL_STATSHLINE": "244",
	"RPL_STATSSLINE": "245",
	"RPL_STATSTLINE": "246",
	"RPL_STATSBLINE": "247",
	"RPL_STATSPLINE": "249",
	"RPL_STATSCONN": "250",
	"RPL_LUSERCLIENT": "251",
	"RPL_LUSEROP": "252",
	"RPL_LUSERUNKNOWN": "253",
	"RPL_LUSERCHANNELS": "254",
	"RPL_LUSERME": "255",
	"RPL_ADMINME": "256",
	"RPL_ADMINLOC1": "257",
	"RPL_ADMINLOC2": "258",
	"RPL_ADMINEMAIL": "259",
	"RPL_TRACELOG": "261",
	"RPL_TRYAGAIN": "263",
	"RPL_LOCALUSERS": "265",
	"RPL_GLOBALUSERS": "266",
	"RPL_START_NETSTAT": "267",
	"RPL_NETSTAT": "268",
	"RPL_END_NETSTAT": "269",
	"RPL_PRIVS": "270",
	"RPL_SILELIST": "271",
	"RPL_ENDOFSILELIST": "272",
	"RPL_NOTIFY": "273",
	"RPL_VCHANEXIST": "276",
	"RPL_VCHANLIST": "277",
	"RPL_VCHANHELP": "278",
	"RPL_GLIST": "280",
	"RPL_CHANINFO_KICKS": "296",
	"RPL_END_CHANINFO": "299",
	"RPL_NONE": "300",
	"RPL_AWAY": "301",
	"RPL_USERHOST": "302",
	"RPL_ISON": "303",
	"RPL_UNAWAY": "305",
	"RPL_NOWAWAY": "306",
	"RPL_WHOISUSER": "311",
	"RPL_WHOISSERVER": "312",
	"RPL_WHOISOPERATOR": "313",
	"RPL_WHOWASUSER": "314",
	"RPL_ENDOFWHO": "315",
	"RPL_WHOISIDLE": "317",
	"RPL_ENDOFWHOIS": "318",
	"RPL_WHOISCHANNELS": "319",
	"RPL_WHOISVIRT": "320",
	"RPL_WHOIS_HIDDEN": "320",
	"RPL_WHOISSPECIAL": "320",
	"RPL_LIST": "322",
	"RPL_LISTEND": "323",
	"RPL_CHANNELMODEIS": "324",
	"RPL_NOCHANPASS": "326",
	"RPL_CHPASSUNKNOWN": "327",
	"RPL_CHANNEL_URL": "328",
	"RPL_CREATIONTIME": "329",
	"RPL_WHOISACCOUNT": "330",
	"RPL_NOTOPIC": "331",
	"RPL_TOPIC": "332",
	"RPL_TOPICWHOTIME": "333",
	"RPL_BADCHANPASS": "339",
	"RPL_USERIP": "340",
	"RPL_INVITING": "341",
	"RPL_INVITED": "345",
	"RPL_INVITELIST": "346",
	"RPL_ENDOFINVITELIST": "347",
	"RPL_EXCEPTLIST": "348",
	"RPL_ENDOFEXCEPTLIST": "349",
	"RPL_VERSION": "351",
	"RPL_WHOREPLY": "352",
	"RPL_NAMREPLY": "353",
	"RPL_WHOSPCRPL": "354",
	"RPL_NAMREPLY_": "355",
	"RPL_LINKS": "364",
	"RPL_ENDOFLINKS": "365",
	"RPL_ENDOFNAMES": "366",
	"RPL_BANLIST": "367",
	"RPL_ENDOFBANLIST": "368",
	"RPL_ENDOFWHOWAS": "369",
	"RPL_INFO": "371",
	"RPL_MOTD": "372",
	"RPL_ENDOFINFO": "374",
	"RPL_MOTDSTART": "375",
	"RPL_ENDOFMOTD": "376",
	"RPL_WHOISHOST": "378",
	"RPL_YOUREOPER": "381",
	"RPL_REHASHING": "382",
	"RPL_YOURESERVICE": "383",
	"RPL_NOTOPERANYMORE": "385",
	"RPL_ALIST": "388",
	"RPL_ENDOFALIST": "389",
	"RPL_TIME": "391",
	"RPL_USERSSTART": "392",
	"RPL_USERS": "393",
	"RPL_ENDOFUSERS": "394",
	"RPL_NOUSERS": "395",
	"RPL_HOSTHIDDEN": "396",
	"ERR_UNKNOWNERROR": "400",
	"ERR_NOSUCHNICK": "401",
	"ERR_NOSUCHSERVER": "402",
	"ERR_NOSUCHCHANNEL": "403",
	"ERR_CANNOTSENDTOCHAN": "404",
	"ERR_TOOMANYCHANNELS": "405",
	"ERR_WASNOSUCHNICK": "406",
	"ERR_TOOMANYTARGETS": "407",
	"ERR_NOSUCHSERVICE": "408",
	"ERR_NOORIGIN": "409",
	"ERR_NORECIPIENT": "411",
	"ERR_NOTEXTTOSEND": "412",
	"ERR_NOTOPLEVEL": "413",
	"ERR_WILDTOPLEVEL": "414",
	"ERR_BADMASK": "415",
	"ERR_TOOMANYMATCHES": "416",
	"ERR_QUERYTOOLONG": "416",
	"ERR_LENGTHTRUNCATED": "419",
	"ERR_UNKNOWNCOMMAND": "421",
	"ERR_NOMOTD": "422",
	"ERR_NOADMININFO": "423",
	"ERR_FILEERROR": "424",
	"ERR_NOOPERMOTD": "425",
	"ERR_TOOMANYAWAY": "429",
	"ERR_EVENTNICKCHANGE": "430",
	"ERR_NONICKNAMEGIVEN": "431",
	"ERR_ERRONEUSNICKNAME": "432",
	"ERR_NICKNAMEINUSE": "433",
	"ERR_NICKCOLLISION": "436",
	"ERR_TARGETTOOFAST": "439",
	"ERR_SERVICESDOWN": "440",
	"ERR_USERNOTINCHANNEL": "441",
	"ERR_NOTONCHANNEL": "442",
	"ERR_USERONCHANNEL": "443",
	"ERR_NOLOGIN": "444",
	"ERR_SUMMONDISABLED": "445",
	"ERR_USERSDISABLED": "446",
	"ERR_NONICKCHANGE": "447",
	"ERR_NOTIMPLEMENTED": "449",
	"ERR_NOTREGISTERED": "451",
	"ERR_IDCOLLISION": "452",
	"ERR_NICKLOST": "453",
	"ERR_HOSTILENAME": "455",
	"ERR_ACCEPTFULL": "456",
	"ERR_ACCEPTEXIST": "457",
	"ERR_ACCEPTNOT": "458",
	"ERR_NOHIDING": "459",
	"ERR_NOTFORHALFOPS": "460",
	"ERR_NEEDMOREPARAMS": "461",
	"ERR_ALREADYREGISTERED": "462",
	"ERR_NOPERMFORHOST": "463",
	"ERR_PASSWDMISMATCH": "464",
	"ERR_YOUREBANNEDCREEP": "465",
	"ERR_KEYSET": "467",
	"ERR_LINKSET": "469",
	"ERR_CHANNELISFULL": "471",
	"ERR_UNKNOWNMODE": "472",
	"ERR_INVITEONLYCHAN": "473",
	"ERR_BANNEDFROMCHAN": "474",
	"ERR_BADCHANNELKEY": "475",
	"ERR_BADCHANMASK": "476",
	"ERR_BANLISTFULL": "478",
	"ERR_BADCHANNAME": "479",
	"ERR_LINKFAIL": "479",
	"ERR_NOPRIVILEGES": "481",
	"ERR_CHANOPRIVSNEEDED": "482",
	"ERR_CANTKILLSERVER": "483",
	"ERR_UNIQOPRIVSNEEDED": "485",
	"ERR_TSLESSCHAN": "488",
	"ERR_NOOPERHOST": "491",
	"ERR_NOFEATURE": "493",
	"ERR_BADFEATURE": "494",
	"ERR_BADLOGTYPE": "495",
	"ERR_BADLOGSYS": "496",
	"ERR_BADLOGVALUE": "497",
	"ERR_ISOPERLCHAN": "498",
	"ERR_CHANOWNPRIVNEEDED": "499",
	"ERR_UMODEUNKNOWNFLAG": "501",
	"ERR_USERSDONTMATCH": "502",
	"ERR_GHOSTEDCLIENT": "503",
	"ERR_USERNOTONSERV": "504",
	"ERR_SILELISTFULL": "511",
	"ERR_TOOMANYWATCH": "512",
	"ERR_BADPING": "513",
	"ERR_BADEXPIRE": "515",
	"ERR_DONTCHEAT": "516",
	"ERR_DISABLED": "517",
	"ERR_WHOSYNTAX": "522",
	"ERR_WHOLIMEXCEED": "523",
	"ERR_REMOTEPFX": "525",
	"ERR_PFXUNROUTABLE": "526",
	"ERR_BADHOSTMASK": "550",
	"ERR_HOSTUNAVAIL": "551",
	"ERR_USINGSLINE": "552",
	"RPL_LOGON": "600",
	"RPL_LOGOFF": "601",
	"RPL_WATCHOFF": "602",
	"RPL_WATCHSTAT": "603",
	"RPL_NOWON": "604",
	"RPL_NOWOFF": "605",
	"RPL_WATCHLIST": "606",
	"RPL_ENDOFWATCHLIST": "607",
	"RPL_WATCHCLEAR": "608",
	"RPL_ISLOCOP": "611",
	"RPL_ISNOTOPER": "612",
	"RPL_ENDOFISOPER": "613",
	"RPL_DCCLIST": "618",
	"RPL_OMOTDSTART": "624",
	"RPL_OMOTD": "625",
	"RPL_ENDOFO": "626",
	"RPL_SETTINGS": "630",
	"RPL_ENDOFSETTINGS": "631",
	"RPL_TRACEROUTE_HOP": "660",
	"RPL_TRACEROUTE_START": "661",
	"RPL_MODECHANGEWARN": "662",
	"RPL_CHANREDIR": "663",
	"RPL_SERVMODEIS": "664",
	"RPL_OTHERUMODEIS": "665",
	"RPL_ENDOF_GENERIC": "666",
	"RPL_WHOWASDETAILS": "670",
	"RPL_WHOISSECURE": "671",
	"RPL_UNKNOWNMODES": "672",
	"RPL_CANNOTSETMODES": "673",
	"RPL_LUSERSTAFF": "678",
	"RPL_TIMEONSERVERIS": "679",
	"RPL_NETWORKS": "682",
	"RPL_YOURLANGUAGEIS": "687",
	"RPL_LANGUAGE": "688",
	"RPL_WHOISSTAFF": "689",
	"RPL_WHOISLANGUAGE": "690",
	"RPL_MODLIST": "702",
	"RPL_ENDOFMODLIST": "703",
	"RPL_HELPSTART": "704",
	"RPL_HELPTXT": "705",
	"RPL_ENDOFHELP": "706",
	"RPL_ETRACEFULL": "708",
	"RPL_ETRACE": "709",
	"RPL_KNOCK": "710",
	"RPL_KNOCKDLVR": "711",
	"ERR_TOOMANYKNOCK": "712",
	"ERR_CHANOPEN": "713",
	"ERR_KNOCKONCHAN": "714",
	"ERR_KNOCKDISABLED": "715",
	"RPL_TARGUMODEG": "716",
	"RPL_TARGNOTIFY": "717",
	"RPL_UMODEGMSG": "718",
	"RPL_OMOTDSTART": "720",
	"RPL_OMOTD": "721",
	"RPL_ENDOFOMOTD": "722",
	"ERR_NOPRIVS": "723",
	"RPL_TESTMARK": "724",
	"RPL_TESTLINE": "725",
	"RPL_NOTESTLINE": "726",
	"RPL_QLIST": "728",
	"RPL_XINFO": "771",
	"RPL_XINFOSTART": "773",
	"RPL_XINFOEND": "774",
	"RPL_SASL_AUTH": "903",
	"ERR_SASL_AUTH": "904",
	"ERR_CANNOTDOCOMMAND": "972",
	"ERR_CANNOTCHANGEUMODE": "973",
	"ERR_CANNOTCHANGECHANMODE": "974",
	"ERR_CANNOTCHANGESERVERMODE": "975",
	"ERR_CANNOTSENDTONICK": "976",
	"ERR_UNKNOWNSERVERMODE": "977",
	"ERR_SERVERMODELOCK": "979",
	"ERR_BADCHARENCODING": "980",
	"ERR_TOOMANYLANGUAGES": "981",
	"ERR_NOLANGUAGE": "982",
	"ERR_TEXTTOOSHORT": "983"
}

module.exports = irc;
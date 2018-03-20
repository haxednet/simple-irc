# simple-irc
An easy-to-use IRC socket wrapper for node.js, written in JavaScript of course!

## Installation
```
npm install simple-irc
```


## Basic Usage
```js
const irc = require("simple-irc");

const bot = new irc({
	server: { address: "irc.snoonet.org", port: 6667 },
	userInfo: { nick: "SimpleIRCBot56622" },
	channels: [
		{ name: "#botwars" }
	]
});

bot.onChannelJoined = function( e ){
	this.sendMessage({ to: e.channel, message: "Hello I am a bot" });
}

bot.onPrivmsg = function( e ){
	if( !e.toChannel ) e.reply( "Hello!" );
}
```



## Authentication
this wrapper supports the following authentication methods:

* `irc().authType.nickServ`
* `irc().authType.saslPlain`

### authType.nickServ

```js
const irc = require("simple-irc");

const bot = new irc({
	server: { address: "irc.snoonet.org", port: 6667 },
	userInfo: {
		nick: "SimpleIRCBot56622",
		auth: {
			type: irc().authType.nickServ,
			user: "MyNickName",
			password: "secret"
		}
	},
	channels: [
		{ name: "#botwars" }
	]
});
```

---

### authType.saslPlain

```js
const irc = require("simple-irc");

const bot = new irc({
	server: { address: "irc.snoonet.org", port: 6667 },
	userInfo: {
		nick: "SimpleIRCBot56622",
		auth: {
			type: irc().authType.saslPlain,
			user: "MySaslUN",
			password: "secret"
		}
	},
	channels: [
		{ name: "#botwars" }
	]
});
```





## Function Reference

### bot.joinChannel({ channel[, key] })
* `channel` {string}
* `key` {string} [optional]

Joins `channel` using the *optional* secret `key`

```js
bot.joinChannel({ channel: "#test", key: "secret" });
```
---

### bot.leaveChannel({ channel[, message] })
* `channel` {string}
* `message` {string} [optional]

Leaves `channel` with an *optional* `message`

```js
bot.leaveChannel({ channel: "#test", message: "bye" });
```
---

### bot.sendMessage({ message, to })
* `message` {string}
* `to` {string}

Sends `message` to the user `to`

`to` is the destination of your message, it can be either a `channel` or a `nick`

```js
bot.sendMessage({ message: "hey there", to: "ircuser123" });
```
---

### bot.sendNotice({ message, to })
* `message` {string}
* `to` {string}

Sends `message` to the user `to`

`to` is the destination of your message, it can be either a `channel` or a `nick`

```js
bot.sendNotice({ message: "hey there", to: "ircuser123" });
```
---
### bot.kickUser({ channel, nick[, message] })
* `channel` {string}
* `nick` {string}
*  `message` {string} [optional]

Kicks `nick` from `channel` with the *optional* `message`

```js
bot.kickUser({ channel: "#channel", nick: "badguy", message: "you have been kicked" });
```

---

### bot.inviteUser({ channel, nick })
* `channel` {string}
* `nick` {string}

Invites `nick` to join `channel`

```js
bot.inviteUser({ channel: "#channel", nick: "goodguy" });
```

---

### bot.setTopic({ channel, topic })
* `channel` {string}
* `topic` {string}

Changes the topic in `channel` to `topic`

```js
bot.setTopic({ channel: "#channel", topic: "welcome!" });
```


## Events Reference

### event.onChannelJoined( e )
* `e.channel` {string}

Emitted when the channel `e.channel` has been joined

```js
bot.onChannelJoined = function( e ){  };
```

---

### event.onChannelLeft( e )
* `e.channel` {string}

Emitted when the channel `e.channel` has been parted

```js
bot.onChannelLeft = function( e ){  };
```

---

### event.onChannelTopicChanged( e )
* `e.channel` {string}
* `e.topic` {string}
* `e.user` {userObject}

Emitted when the `e.topic` has changed in the channel `e.channel`

```js
bot.onChannelTopicChanged = function( e ){  };
```

---

### event.onConnect()

Emitted when the socket connection is established, regardless of IRC state

```js
bot.onConnect = function(){ console.log( "Socket connected" ) };
```

---


### event.onConnected()

Emitted when the connection to IRC has succeeded

```js
bot.onConnected = function(){ console.log( "Connected to IRC" ) };
```

---

### event.onConnected()

Emitted when the connection to IRC has succeeded

```js
bot.onConnected = function(){ console.log( "Connected to IRC" ) };
```

---

### event.onData( e )
* `e.data` {string}

Emitted when socket has received an IRC packet

```js
bot.onData = function( e ){ console.log( e.data ) };
```

---

### event.onDisconnect()

Emitted when socket has disconnected

```js
bot.onDisconnect = function( e ){  };
```

---

### event.onError( e )
* `e.message` {string}

Emitted when there has been a fatal error

```js
bot.onError = function( e ){ console.log( e.message ) };
```

---

### event.onModeChanged( e )
* `e.for` {string}
* `e.modes` {array}

Emitted when the `e.modes` for `e.for` has been changed

`e.modes` contains an array of changed modes in the form of objects containing `mode`, `state` and `value`.
state is either `add` or `remove`. value is blank unless applicable.

**For example**: if `bob!user@host.com` was banned in channel `#channel` then `e.for` would be `#channel` and
the array `e.modes` would contain an object like *{ mode: "b", state: "add", value: "bob!user@host.com" }*

```js
bot.onModeChanged = function( e ){  };
```

---

### event.onNickChanged( e )
* `e.old` {string}
* `e.new` {string}

Emitted when the user `e.old` changes nicks to `e.new`

```js
bot.onNickChanged = function( e ){  };
```

---

### event.onNotice( e )
* `e.from` {string}
* `e.to` {string}
* `e.message` {string}
* `e.toChannel` {boolean}
* `e.reply` {function}

Emitted when the user `e.from` sends a notice of `e.message` to `e.to`, which can be either a nick or channel.
If the notice was to a channel then `e.toChannel` will be **true**.

`e.reply` can be used to send an immediate reply of type PRIVMSG to `e.to`.

```js
bot.onNotice = function( e ){ 
	if( e.toChannel ) e.reply( e.from + " please don't send channel notices!" );
};
```
---

### event.onNumeric( e )
* `e.number` {integer}
* `e.data` {string}

Emitted when an IRC numerical packet is received.
`e.number` is the relevant numerical value and `e.data` is the triggering packet

```js
bot.onNumeric = function( e ){ 
	if( e.number == 1 ) console.log( "Got the IRC welcome packet!" );
};
```
---

### event.onPrivmsg( e )
* `e.from` {string}
* `e.to` {string}
* `e.message` {string}
* `e.toChannel` {boolean}
* `e.reply` {function}

Emitted when the user `e.from` sends a privmsg of `e.message` to `e.to`, which can be either a nick or channel.
If the message was to a channel then `e.toChannel` will be **true**.

`e.reply` can be used to send an immediate reply of type PRIVMSG to `e.to`.

```js
bot.onPrivmsg = function( e ){ 
	if( !e.toChannel ) e.reply( "I got your PM!" );
};
```
---

### event.onProtocolError( e )
* `e.code` {integer}
* `e.message` {string}

Emitted when an IRC numerical error is received.

```js
bot.onProtocolError = function( e ){ 
	if( e.number == 474 ) console.log( "uhoh banned from a channel" );
};
```
---

### event.onUserJoined( e )
* `e.user` {string}
* `e.channel` {string}

Emitted when `e.user` joins the channel `e.channel`

```js
bot.onUserJoined = function( e ){ 
	console.log( e.user  + " has joined " + e.channel );
};
```

---

### event.onUserKicked( e )
* `e.user` {string}
* `e.kicker` {string}
* `e.channel` {string}
* `e.reason` {string}

Emitted when `e.user` is kicked from the channel `e.channel` by `e.kicker`

```js
bot.onUserKicked = function( e ){ 
	console.log( e.user  + " was kicked from " + e.channel );
};
```
---

### event.onUserLeft( e )
* `e.user` {string}
* `e.channel` {string}
* `e.message` {string}

Emitted when `e.user` leave the channel `e.channel` with the message `e.message`

```js
bot.onUserLeft = function( e ){ 
	console.log( e.user  + " has left " + e.channel );
};
```
---

### event.onUserQuit( e )
* `e.user` {string}
* `e.message` {string}

Emitted when `e.user` quits IRC with the message `e.message`

```js
bot.onUserQuit = function( e ){ 
	console.log( e.user  + " has quit: " + e.message );
};
```
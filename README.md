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
	userInfo: { nick: "SimpleIRCBot56622", auth: { type: irc().authType.none } },
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
## Basic Functions

- **bot.joinChannel({ channel: "#channel" });** *optional: key*
- **bot.leaveChannel({ channel: "#channel" });**
- **irc.sendMessage({ type: "privmsg", to: "someuser", message: "hey" });** *optional: type*
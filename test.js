const irc = require("./irc.js");
const readline = require('readline');

const bot = new irc({
	server: { address: "chat.freenode.net", port: 6667 },
	userInfo: { nick: "roar", username: "roar", auth: {
			type: irc().authType.none
		} },
	channels: [
		{ name: "#burd" }
	]
});



const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
	eval(input);
});


bot.onProtocolError = function( e ){console.log(e)};

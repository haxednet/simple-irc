const irc = require("./irc.js");
const readline = require('readline');

const bot = new irc({
	server: { address: "chat.freenode.net" },
	userInfo: { nick: "roar" },
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

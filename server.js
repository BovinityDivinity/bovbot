var auth = require('./auth');
var request = require('request');
var DB = require('mysql');
var irc = require('irc');
var checkTables = require('./checkTables');

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


//Database Connection
var connection = DB.createPool({
    connectionLimit: 20,
    host: auth.dbaddress,
    user: auth.dbuser,
    password: auth.password,
    database: auth.dbname
});

//IRC Connection
var config = {
    port: 6667,
    server: 'irc.twitch.tv',
    nick: 'bovbot',
    password: auth.oauth
};

//Create bot IRC client, connect to Twitch IRC, join default channels, and perform capability requests
var bot = new irc.Client(config.server, config.nick, { password: config.password, floodProtection: true, floodProtectionDelay: 1000, autoConnect: false });

bot.connect(function () {
    console.log('Logging in: irc.twitch.tv');
    bot.send('CAP REQ', 'twitch.tv/membership');
    bot.send('CAP REQ', 'twitch.tv/commands');
    bot.send('CAP REQ', 'twitch.tv/tags'); //Need IRCv3 capabilities!
    bot.join('#bovbot');
    bot.join('#binnietv');
});

//Begin Bot Event Listeners
bot.addListener('error', function (message) {
    console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});

bot.addListener('join', function (channel, nick) {
    if (nick == 'bovbot') {
        console.log(nick + ': Joining channel: ' + channel);
        checkTables(channel, connection);
    }
});

// Raw Data Dump for Debugging
/*bot.addListener('raw', function (message) { 
    console.log(message);
});*/

bot.addListener('notice', function (nick, to, text, message) {
    console.log(message);
});

// Handler for Chat Messages
bot.addListener('message', function (from, to, message, userType) {
    var isMod = false;
    var channel = to.substring(1);

    if (userType == 'mod' || from.toLowerCase() == to.substring(1))
        isMod = true;

    if (message.match(/[^\w\s!?.]{10,}/g)) {
        if (!isMod) {
            console.log('ASCII Spam Detected: Not Moderator. Message: ' + message);
            bot.say(to, 'Timed out ' + from + ' for ascii spam (5 min).');
            bot.say(to, '.timeout ' + from + ' 300');
        }
    }

    message = message.replace(/[`~@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');

    connection.query('INSERT INTO ' + to.substring(1) + '_chatlog (viewer, text) VALUES ("' + from + '","' + message + '")', function (err, rows, fields) {
        if (err)
            throw err;
    });

    if (message.match(/^!/)) {
        if (message == '!currency') {
            connection.query('SELECT credits FROM ' + channel + '_viewers WHERE viewer = "' + from + '" UNION SELECT currencyName FROM channels WHERE name = "' + channel + '"', function (err, rows, fields) {
                if (err)
                    throw err;
                if (rows[0])
                    bot.say(to, from + ' currently has ' + rows[0]['credits'] + ' ' + rows[1]['credits'] + '.');
                else
                    bot.say(to, 'Viewer ' + from + ' not found. (No currency yet?)');
            });
        }
        else if (message.match(/^!bet /)) {
            var parsedRequest = message.split(' ');
            var credits;
            var roll;
            var currencyName;
            if (parsedRequest[1]) {
                parsedRequest[1] = Number(parsedRequest[1]);
                if (!isNaN(parsedRequest[1])) {
                    connection.query('SELECT credits FROM ' + channel + '_viewers WHERE viewer = "' + from + '" UNION SELECT currencyName FROM channels WHERE name = "' + channel + '" UNION SELECT minRoll FROM channels WHERE name = "' + channel + '"', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0]) {
                            credits = rows[0]['credits'];
                            currencyName = rows[1]['credits'];
                            minRoll = rows[2]['credits'];
                            if (parsedRequest[1] > credits) {
                                bot.say(to, from + ': You do not have that much currency to gamble.');
                            }
                            else {
                                roll = getRandomInt(1, 100);
                                if (roll <= minRoll) {
                                    credits = credits - parsedRequest[1];
                                    connection.query('UPDATE ' + channel + '_viewers SET credits = ' + credits + ' WHERE viewer = "' + from + '"', function (err, rows, fields) {
                                        if (err)
                                            throw err;
                                        bot.say(to, from + ' rolled a ' + roll + '. Lost ' + parsedRequest[1] + ' ' + currencyName + ' and now has ' + credits + ' ' + currencyName + ' remaining.');
                                    });
                                }
                                else {
                                    credits = Number(credits) + Number(parsedRequest[1]);
                                    connection.query('UPDATE ' + channel + '_viewers SET credits = ' + credits + ' WHERE viewer = "' + from + '"', function (err, rows, fields) {
                                        if (err)
                                            throw err;
                                        bot.say(to, from + ' rolled a ' + roll + '. Won ' + parsedRequest[1] + ' ' + currencyName + ' and now has ' + credits + ' ' + currencyName + ' remaining.');
                                    });
                                }
                            }
                        }
                    });
                }
                else
                    bot.say(to, from + ": Invalid Bet.");
            }
            else
                bot.say(to, from + ": Invalid Bet.");
        }
        else if (message == '!giveaway') {
            if (from == to.substring(1)) {
                bot.say(to, 'Giveaway Time!');
                connection.query('SELECT viewer FROM ' + to.substring(1) + '_chatlog ORDER BY RAND() LIMIT 1', function (err, rows, fields) {
                    if (err)
                        throw err;
                    bot.say(to, 'And the winner is: ' + rows[0]['viewer'].toUpperCase() + rows[0]['viewer'].substring(1) + '!');
                });
            }
            else
                bot.say(to, 'Only the broadcaster decides when to do a giveaway.');
        }
        else if (message == '!uptime') {
            request('https://api.twitch.tv/kraken/streams/' + to.substring(1) + '?oauth_token=' + auth.oauth.substring(6), function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var output = JSON.parse(body);
                    if (output['stream']) {
                        var currentTime = Date.now();
                        var offsetTime = new Date(currentTime += (new Date().getTimezoneOffset() * 60000));
                        var streamTime = output['stream']['created_at'].replace(/-/g, '/').replace(/T/g, ' ').replace(/Z/g, ' ');
                        var uptimeMS = new Date(Math.abs(offsetTime.valueOf() - new Date(streamTime).valueOf()));
                        var parseUptime = '';
                        if (uptimeMS.getUTCDate() - 1 > 0)
                            parseUptime += uptimeMS.getUTCDate() - 1 + " days, ";
                        if (uptimeMS.getUTCHours() > 0)
                            parseUptime += uptimeMS.getUTCHours() + " hours, ";
                        if (uptimeMS.getUTCMinutes() > 0)
                            parseUptime += uptimeMS.getUTCMinutes() + " minutes, ";
                        if (uptimeMS.getUTCSeconds() > 0)
                            parseUptime += uptimeMS.getUTCSeconds() + " seconds. ";
                        bot.say(to, parseUptime);
                    }
                    else {
                        bot.say(to, 'Channel is not online.');
                    }
                }
                else
                    console.log('Got HTTP error');
            });
        }
        else if (message.match(/^!8ball/i)) {
            var parsedRequest = message.split(' ');
            if (parsedRequest[1]) {
                var index = getRandomInt(0, 19);
                var answers = ['It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.', 'As I see it, yes.', 'Most likely.',
                    'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.',
                    'Concentrate and ask again.', 'Don\'t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'];
                bot.say(to, from + ': ' + answers[index]);
            }
            else {
                bot.say(to, 'You didn\'t ask a question, dummy.');
            }
        }
        else if (message.match(/^!hs/i)) {
            var parsedRequest = message.slice(4);
            parsedRequest = parsedRequest.toLowerCase();
            var apiURL = 'https://omgvamp-hearthstone-v1.p.mashape.com/cards/search/' + parsedRequest + '?mashape-key=Ffd1pcNXiNmshk5CMzxO8ZTuOjIbp1lT552jsncraLnadOWmmh&collectible=1';
            request(apiURL, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var output = JSON.parse(body);
                    if (!output[0]['playerClass']) {
                        output[0]['playerClass'] = 'Neutral';
                    }
                    if (output[0]['text']) {
                        output[0]['text'] = output[0]['text'].replace(/<b>/g, '');
                        output[0]['text'] = output[0]['text'].replace(/<\/b>/g, '');
                        if (output[0]['type'] == 'Minion') {
                            bot.say(to, "Card Name: " + output[0]['name'] + ", Cost: (" + output[0]['cost'] + "), Class: " + output[0]['playerClass'] + ", Text: " + output[0]['text'] +
                                ", Attack: " + output[0]['attack'] + ", Health: " + output[0]['health']);
                        }
                        else {
                            bot.say(to, "Card Name: " + output[0]['name'] + ", Cost: (" + output[0]['cost'] + "), Class: " + output[0]['playerClass'] + ", Text: " + output[0]['text']);
                        }
                    }
                    else {
                        if (output[0]['type'] == 'Minion') {
                            bot.say(to, "Card Name: " + output[0]['name'] + ", Cost: (" + output[0]['cost'] + "), Class: " + output[0]['playerClass'] + ", Attack: " + output[0]['attack'] + ", Health: " + output[0]['health']);
                        }
                        else {
                            bot.say(to, "Card Name: " + output[0]['name'] + ", Cost: (" + output[0]['cost'] + "), Class: " + output[0]['playerClass']);
                        }
                    }
                }
                else {
                    var output = JSON.parse(body);
                    bot.say(to, 'Error retrieving data from API: ' + output['message']);
                }
            });
        }
        else if (message.match(/^!skin/i)) {
            var parsedRequest = message.slice(6);
            parsedRequest = parsedRequest.replace('StatTrak', 'StatTrak%E2%84%A2');
            parsedRequest = parsedRequest.replace('ST', 'StatTrak%E2%84%A2');
            parsedRequest = parsedRequest.replace('Flip Knife', '%E2%98%85 Flip Knife');
            parsedRequest = parsedRequest.replace('Karambit', '%E2%98%85 Karambit');
            parsedRequest = parsedRequest.replace('Butterfly Knife', '%E2%98%85 Butterfly Knife');
            parsedRequest = parsedRequest.replace('Falchion Knife', '%E2%98%85 Falchion Knife');
            parsedRequest = parsedRequest.replace('Gut Knife', '%E2%98%85 Gut Knife');
            parsedRequest = parsedRequest.replace('Huntsman Knife', '%E2%98%85 Huntsman Knife');
            parsedRequest = parsedRequest.replace('Shadow Daggers', '%E2%98%85 Shadow Daggers');
            parsedRequest = parsedRequest.replace('Bayonet', '%E2%98%85 Bayonet');
            parsedRequest = parsedRequest.replace('M9 Bayonet', '%E2%98%85 M9 Bayonet');
            parsedRequest = parsedRequest.replace('Bowie Knife', '%E2%98%85 Bowie Knife');
            parsedRequest = parsedRequest.replace('(FN)', '(Factory New)');
            parsedRequest = parsedRequest.replace('(WW)', '(Well-Worn)');
            parsedRequest = parsedRequest.replace('(FT)', '(Field-Tested)');
            parsedRequest = parsedRequest.replace('(BS)', '(Battle-Scarred)');
            parsedRequest = parsedRequest.replace('(MW)', '(Minimal Wear)');
            var apiURL = 'http://steamcommunity.com/market/priceoverview/?currency=1&appid=730&market_hash_name=' + parsedRequest;
            request(apiURL, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var output = JSON.parse(body);
                    bot.say(to, 'Price (Lowest): ' + output['lowest_price'] + '. Price (Median): ' + output['median_price']);
                }
                else
                    bot.say(to, 'Steam API Returned an Error. Bad skin name?');
            });
        }
        else if (message.match(/^!champion/i)) {
            var parsedRequest = message.split(' ');
            var championName = parsedRequest[1];
            var spellID = parsedRequest[2];
            var champID = 0;
            var botOutput = '';
            var hotkey;
            var hotkeyArray = ['Q', 'W', 'E', 'R', 'Passive'];
            var apiURL = 'https://na.api.pvp.net/api/lol/static-data/na/v1.2/champion?api_key=4c8b1781-16ed-47cf-a8e9-34834c381fa9';
            request(apiURL, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var output = JSON.parse(body);
                    if (output['data'][championName]) {
                        champID = output['data'][championName]['id'];
                        apiURL = 'https://na.api.pvp.net/api/lol/static-data/na/v1.2/champion/' + champID + '?api_key=4c8b1781-16ed-47cf-a8e9-34834c381fa9&champData=all';
                        if (!spellID) {
                            request(apiURL, function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    output = JSON.parse(body);
                                    bot.say(to, championName + ": " + output['tags']);
                                    for (var i = 0; i <= 5; i++) {
                                        if (i == 5)
                                            botOutput += "(Passive): " + "'" + output['passive']['name'] + "'";
                                        else {
                                            if (output['spells'][i]) {
                                                botOutput += '(' + hotkeyArray[i] + "): '" + output['spells'][i]['name'] + "'" + ' ';
                                            }
                                        }
                                    }
                                    bot.say(to, botOutput);
                                }
                            });
                        }
                        else {
                            request(apiURL, function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    output = JSON.parse(body);
                                    if (spellID == 'Q')
                                        spellID = 0;
                                    else if (spellID == 'W')
                                        spellID = 1;
                                    else if (spellID == 'E')
                                        spellID = 2;
                                    else if (spellID == 'R')
                                        spellID = 3;
                                    if (spellID == 'Passive') {
                                        botOutput = output['passive']['name'] + ": " + output['passive']['sanitizedDescription'];
                                    }
                                    else {
                                        if (output['spells'][spellID]) {
                                            botOutput = output['spells'][spellID]['name'] + ': ' + output['spells'][spellID]['sanitizedDescription'];
                                        }
                                        else {
                                            bot.say(to, 'API returned an error. Bad Champion/Spell name?');
                                        }
                                    }
                                    bot.say(to, botOutput);
                                }
                            });
                        }
                    }
                    else {
                        bot.say(to, 'API returned an error. Bad Champion/Spell name?');
                    }
                }
            });
        }
        else if (message.match(/^!join /)) {
            if (to == "#bovbot") {
                if (from == 'bovinity') {
                    var parsedMessage = message.split(' ');
                    bot.join('#' + parsedMessage[1], function () { });
                }
                else {
                    console.log('Join request for channel: ' + from);
                    bot.join('#' + from, function () { });
                }
            }
        }
        else if (message.match(/^!part /)) {
            if (to == "#bovbot") {
                if (from == 'bovinity') {
                    var parsedMessage = message.split(' ');
                    bot.part('#' + parsedMessage[1], function () { });
                }
                else {
                    console.log('Part request for channel: ' + from);
                    bot.part('#' + from, function () { });
                }
            }
        }
        else if (message.match(/^!addcom /)) {
            var commandsTable = to.substring(1) + '_commands';
            if (isMod) {
                var parsedRequest = message.split(' ');
                var newCommand = parsedRequest[1];
                var newResponse = parsedRequest.slice(2).join(' ');
                if (!newCommand.match(/^!/) || !newResponse)
                    bot.say(to, 'Invalid command format. Must begin with ! and contain a suitable response.');
                else {
                    connection.query('SELECT command FROM ' + commandsTable + ' WHERE command = "' + newCommand + '" LIMIT 1', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0])
                            bot.say(to, 'Command ' + newCommand + ' already exists, ignoring.');
                        else
                            connection.query('INSERT INTO ' + commandsTable + ' (command, response) VALUES ("' + newCommand + '","' + newResponse + '")', function (err, rows, fields) {
                                if (err)
                                    throw err;
                                bot.say(to, 'Command ' + newCommand + ' added.');
                            });
                    });
                }
            }
            else
                bot.say(to, 'Sorry, only moderators can add commands.');
        }
        else if (message.match(/^!delcom /)) {
            var commandsTable = to.substring(1) + '_commands';
            if (isMod) {
                var parsedRequest = message.split(' ');
                var deletedCommand = parsedRequest[1];
                connection.query('SELECT command FROM ' + commandsTable + ' WHERE command = "' + deletedCommand + '" LIMIT 1', function (err, rows, fields) {
                    if (err)
                        throw err;
                    if (rows[0])
                        connection.query('DELETE FROM ' + commandsTable + ' WHERE command = "' + deletedCommand + '" LIMIT 1', function (err, rows, fields) {
                            if (err)
                                throw err;
                            else
                                bot.say(to, 'Deleting command ' + deletedCommand + '.');
                        });
                    else
                        bot.say(to, 'Command ' + deletedCommand + ' not found.');
                });
            }
            else
                bot.say(to, 'Sorry, only moderators can delete commands.');
        }
        else if (message.match(/^!editcom /)) {
            var commandsTable = to.substring(1) + '_commands';
            if (isMod) {
                var parsedRequest = message.split(' ');
                var editCommand = parsedRequest[1];
                var newResponse = parsedRequest.slice(2).join(' ');
                if (!parsedRequest[2]) {
                    bot.say(to, 'Invalid format, please specify a response for the given command.');
                }
                else {
                    connection.query('SELECT command FROM ' + commandsTable + ' WHERE command = "' + editCommand + '" LIMIT 1', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0])
                            connection.query('UPDATE ' + commandsTable + ' SET response = "' + newResponse + '" WHERE command = "' + editCommand + '" LIMIT 1', function (err, rows, fields) {
                                if (err)
                                    throw err;
                                else
                                    bot.say(to, 'Updated command ' + editCommand + '.');
                            });
                        else
                            bot.say(to, 'Command ' + editCommand + ' not found.');
                    });
                }
            }
            else {
                bot.say(to, 'Sorry, only moderators can edit commands.');
            }
        }
        else if (message == '!commands') {
            bot.say(to, 'Commands for this channel: http://www.bovinitydivinity.com/commands/' + to.substring(1));
        }
        else if (message.match(/^!topic /)) {
            if (isMod) {
                connection.query('SELECT auth_key FROM channels WHERE name = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                    if (err)
                        throw err;
                    if (rows[0]) {
                        var options = {
                            url: 'https://api.twitch.tv/kraken/channels/' + to.substring(1) + '?channel[status]=' + message.substr(message.indexOf(" ") + 1) + '&_method=put&oauth_token=' + rows[0]['auth_key'],
                            method: 'get'
                        };
                        request(options, function (error, response, body) {
                            if (error)
                                console.log(error);
                        });
                        bot.say(to, from + ': Channel Topic Updated.');
                    }
                });
            }
            else {
                bot.say(to, 'Sorry, only moderators can change the stream topic.');
            }
        }
        else if (message.match(/^!game /)) {
            if (isMod) {
                connection.query('SELECT auth_key FROM channels WHERE name = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                    if (err)
                        throw err;
                    if (rows[0]) {
                        var options = {
                            url: 'https://api.twitch.tv/kraken/channels/' + to.substring(1) + '?channel[game]=' + message.substr(message.indexOf(" ") + 1) + '&_method=put&oauth_token=' + rows[0]['auth_key'],
                            method: 'get'
                        };
                        request(options, function (error, response, body) {
                            if (error)
                                console.log(error);
                        });
                        bot.say(to, from + ': Channel Game Updated.');
                    }
                });
            }
            else {
                bot.say(to, 'Sorry, only moderators can change the stream game.');
            }
        }
        else {
            var currentChannel = to.substring(1) + '_commands';
            var commandArray = message.split(' ');
            connection.query('SELECT response FROM ' + currentChannel + ' WHERE command = "' + commandArray[0] + '" LIMIT 1', function (err, rows, fields) {
                if (err)
                    throw err;
                if (rows[0]) {
                    if (rows[0].response.indexOf('$(random)') != -1) {
                        request('https://tmi.twitch.tv/group/user/' + to.substring(1) + '/chatters', function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var output = JSON.parse(body);
                                var combinedArray = output['chatters']['moderators'].concat(output['chatters']['viewers']);
                                rows[0].response = rows[0].response.replace('$(random)', combinedArray[getRandomInt(0, combinedArray.length - 1)]);
                            }
                            if (rows[0].response.indexOf('$(user)') != -1)
                                rows[0].response = rows[0].response.replace('$(user)', from);
                            if (rows[0].response.match(/\$\([0-9]\)/g)) {
                                if ((commandArray.length - 1) == rows[0].response.match(/\$\([0-9]\)/g).length) {
                                    for (var i = 1; i < commandArray.length; i++) {
                                        rows[0].response = rows[0].response.replace('$(' + i + ')', commandArray[i]);
                                    }
                                    bot.say(to, rows[0].response);
                                }
                                else
                                    bot.say(to, 'Invalid number of parameters.');
                            }
                            else
                                bot.say(to, rows[0].response);
                        });
                    }
                }
            });
        }
    }
});
// End Bot Event Listeners

// Check Timed Messages
setInterval(checkTimers, 900000);
function checkTimers() {
    var channelList = Object.keys(bot.chans);
    for (var i = 0; i < channelList.length; i++) {
        (function (i) {
            connection.query('SELECT * FROM timers WHERE channel = "' + channelList[i].substring(1) + '"', function (err, rows, fields) {
                if (err)
                    throw err;
                for (var x = 0; x < rows.length; x++) {
                    (function (x) {
                        var newDate = new Date(rows[x].lastfired);
                        var timerFire = newDate.valueOf() + (rows[x].timer * 60000) - 1;
                        var timeNow = new Date().valueOf();
                        if (timerFire < timeNow) {
                            bot.say(channelList[i], rows[x].response);
                            connection.query('UPDATE timers SET lastfired = CURRENT_TIMESTAMP WHERE id = "' + rows[x].ID + '" LIMIT 1', function (err, rows, fields) {
                                if (err)
                                    throw err;
                            });
                        }
                    })(x);
                }
            });
        })(i);
    }
}

// Track viewers/award currency
setInterval(trackViewers, 900000);
function trackViewers() {
    var channelList = Object.keys(bot.chans);
    for (var i = 0; i < channelList.length; i++) {
        (function (i) {
            request('https://tmi.twitch.tv/group/user/' + channelList[i].substring(1) + '/chatters', function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var output = JSON.parse(body);
                    var combinedArray = output['chatters']['moderators'].concat(output['chatters']['viewers']);
                    connection.query('SHOW TABLES LIKE "' + channelList[i].substring(1) + '_viewers"', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0]) {
                            for (var x = 0; x < combinedArray.length; x++) {
                                (function (x) {
                                    connection.query('INSERT INTO ' + channelList[i].substring(1) + '_viewers (viewer, credits) VALUES ("' + combinedArray[x] + '", "10") ON DUPLICATE KEY UPDATE credits = credits + 10', function (err, rows, fields) {
                                        if (err)
                                            throw err;
                                    });
                                })(x);
                            }
                        }
                        else {
                            connection.query('CREATE TABLE ' + channelList[i].substring(1) + '_viewers (id INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY, viewer VARCHAR(50) NOT NULL UNIQUE, credits INT UNSIGNED, regular INT UNSIGNED)', function (err, rows, fields) {
                                if (err)
                                    throw err;
                                for (var x = 0; x < combinedArray.length; x++) {
                                    (function (x) {
                                        connection.query('INSERT INTO ' + channelList[i].substring(1) + '_viewers (viewer, credits) VALUES ("' + combinedArray[x] + '", "10") ON DUPLICATE KEY UPDATE credits = credits + 10', function (err, rows, fields) {
                                            if (err)
                                                throw err;
                                        });
                                    })(x);
                                }
                            });
                        }
                    });
                }
            });
        })(i);
    }
}
//////////////////////
// Begin Web interface
//////////////////////
var express = require('express');
var app = express();
var server = require('http').Server(app);
var bodyParser = require('body-parser');
var session = require('express-session');
var io = require('socket.io')(server);

app.use(session({ secret: auth.secret, resave: false, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('views/html'));
server.listen(80, function () {
    console.log('Listening on Port 80');
});

// Draw Socket
io.on('connection', function (socket) {
    console.log('Socket Connection');
    socket.on('join', function (room) {
        console.log('Room: ' + room);
        socket.join(room);
    });
    socket.on('drawing', function (x, y, currX, currY, prevX, prevY, room) {
        io.to(room).emit('draw', x, y, currX, currY, prevX, prevY);
    });
    socket.on('erase', function () {
        io.emit('erase');
    });
});

// Header Controls
app.all('*', function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
    res.setHeader('Surrogate-Control', 'no-store')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    next();
});

app.get('*', function (req, res, next) {
    if (req.headers.host) {
        if (req.headers.host != 'www.bovinitydivinity.com') {
            res.redirect(301, 'http://www.bovinitydivinity.com' + req.url);
        }
        else {
            next();
        }
    }
});

// Post Handlers
app.post('/', function (req, res) {
    switch (req.body.op) {
        case 'login':
            function getHashValue(key) {
                var matches = req.body.clientHash.match(new RegExp(key + '=([^&]*)'));
                return matches ? matches[1] : null;
            }
            var hash = getHashValue('access_token');
            request('https://api.twitch.tv/kraken?oauth_token=' + hash, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var output = JSON.parse(body);
                    req.session.user = output['token']['user_name'];
                    console.log('Website Login. User:' + req.session.user + ' - Auth_key:' + hash);
                    connection.query('INSERT INTO channels (name, auth_key) VALUES ("' + req.session.user + '", "' + hash + '") ON DUPLICATE KEY UPDATE auth_key = "' + hash + '"', function (err, rows, fields) {
                        checkTables(req.session.user, connection);
                        res.end('done');
                    });
                }
            });
            break;
        case 'functions':
            connection.query('UPDATE channels SET league = "' + req.body.league + '", csgo = "' + req.body.csgo + '", hearthstone = "' + req.body.hearthstone + '", currencyName = "' + req.body.currencyName + '", minRoll = "' + req.body.minRoll + '" WHERE name = "' + req.session.user + '" LIMIT 1', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
        case 'deleteCommand':
            var commandsTable = userSession.user + '_commands';
            connection.query('DELETE FROM ' + commandsTable + ' WHERE command = "' + req.body.command + '" LIMIT 1', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
        case 'editCommand':
            var commandsTable = userSession.user + '_commands';
            connection.query('UPDATE ' + commandsTable + ' SET response = "' + req.body.response + '" WHERE command = "' + req.body.command + '" LIMIT 1', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
        case 'addTimer':
            connection.query('INSERT INTO timers (response, timer, channel) VALUES ("' + req.body.announcement + '", "' + req.body.delay + '", "' + userSession.user + '")', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
        case 'deleteTimer':
            connection.query('DELETE FROM timers WHERE ID = "' + req.body.timerID + '"', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
        case 'join':
            bot.join('#' + req.body.channel, function () {
                var channelList = Object.keys(bot.chans);
                if (channelList.indexOf('#' + userSession.user) != -1)
                    var botStatus = 'is';
                else
                    var botStatus = 'is not';
                console.log('Channel Join Request: ' + req.body.channel);
                res.send({ msg: botStatus });
                res.end('done');
            });
            break;
        case 'part':
            bot.part('#' + req.body.channel, function () {
                console.log('Channel Part Request: ' + req.body.channel);
                res.send({ msg: 'is not' });
                res.end('done');
            });
            break;
        case 'addIssue':
            connection.query('INSERT INTO issues (issue) VALUES ("' + req.body.issue + '")', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
        case 'resolveIssue':
            connection.query('DELETE FROM issues WHERE id = "' + req.body.id + '"', function (err, rows, fields) {
                if (err)
                    throw err;
                res.end('done');
            });
            break;
    }
});

// The Draw Webpage.
app.get('/draw/:channel/drawframe.html', function (req, res) {
    res.render('drawframe.ejs');
});

// Public Pages, no user session.
app.get('/commands/:channel', function (req, res) {
    var tableName = req.params.channel + '_commands';
    connection.query('SELECT response, timer FROM timers WHERE channel = "' + req.params.channel + '"', function (err, timers, fields) {
        connection.query('SELECT command, response FROM ' + tableName, function (err, commands, fields) {
            res.render('commandsPublic.ejs', { channel: req.params.channel, commands: commands, timers: timers });
        });
    });
});

app.get('/about', function (req, res) {
    res.render('about.ejs', { channel: req.session.user });
});

app.get('/issues', function (req, res) {
    connection.query('SELECT * FROM issues', function (err, rows, fields) {
        res.render('issues.ejs', { issues: rows });
    });
});

// User config pages requiring a login session.
app.get('/dashboard', function (req, res) {
    if (req.session.user) {
        var channelList = Object.keys(bot.chans);
        if (channelList.indexOf('#' + req.session.user) != -1)
            var botStatus = 'is';
        else
            var botStatus = 'is not';
        res.render('dashboard.ejs', { channel: req.session.user, status: botStatus });
        res.end('done');
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/commands', function (req, res) {
    if (req.session.user) {
        var tableName = req.session.user + '_commands';
        connection.query('SELECT id, response, timer FROM timers WHERE channel ="' + req.session.user + '"', function (err, timers, fields) {
            connection.query('SELECT command, response FROM ' + tableName, function (err, commands, fields) {
                res.render('commands.ejs', { channel: req.session.user, commands: commands, timers: timers });
            });
        });
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/viewers', function (req, res) {
    if (req.session.user) {
        connection.query('SELECT viewer, credits FROM ' + req.session.user + '_viewers ORDER BY credits DESC', function (err, rows, fields) {
            res.render('viewers.ejs', { channel: req.session.user, viewers: rows });
        });
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/functions', function (req, res) {
    if (req.session.user) {
        connection.query('SELECT hearthstone, csgo, league, currencyName, minRoll FROM channels WHERE name = "' + req.session.user + '"', function (err, rows, fields) {
            if (err)
                throw err;
            res.render('functions.ejs', { channel: req.session.user, hearthstone: rows[0]['hearthstone'], csgo: rows[0]['csgo'], league: rows[0]['league'], currencyName: rows[0]['currencyName'], minRoll: rows[0]['minRoll'] });
        });
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/giveaway', function (req, res) {
    res.render('giveaway.ejs');
});

app.get('/', function (req, res) {
    console.log('Website Client Connection. IP: ' + req.connection.remoteAddress);
    console.log('User-Agent: ' + req.headers['user-agent'] + '\n');
    res.render('index.ejs', { clientid: auth.clientid, sessionName: req.session.user });
});

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.render('logout.ejs', {});
});

// API Routes
app.get('/api/:table', function (req, res) {
    connection.query('SHOW TABLES LIKE "' + req.params.table + '"', function (err, rows, fields) {
        if (err)
            throw err;
        if (!rows[0])
            res.send('Error: Database Table Not Found');
        else {
            connection.query('SELECT * FROM ' + req.params.table, function (err, rows, fields) {
                if (err)
                    throw err;
                if (rows[0])
                    res.send(rows);
            });
        }
    });
});

// Final catch-all routing to prevent 404's
app.get('/*', function (req, res) {
    res.redirect(301, "http://www.bovinitydivinity.com");
});
// End Web Interface

//Cleaning up on exit
process.stdin.resume();
function exitHandler(options, err) {
    connection.end();
    if (options.cleanup)
        console.log('Closing BovBot...');
    if (err)
        console.log(err.stack);
    if (options.exit)
        process.exit();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
// End Web Interface
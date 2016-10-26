var auth = require('./auth');
var request = require('request');
var DB = require('mysql');
var irc = require('irc');

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
    bot.join('#bovbot');
    bot.join('#binnietv');
    bot.join('#roofonfire');
});

//Begin Bot Event Listeners
bot.addListener('error', function (message) {
    console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});

bot.addListener('join', function (channel, nick, message) {
    if (nick == 'bovbot') {
        bot.say(channel, '.mods');
        connection.query('SHOW TABLES LIKE "' + channel.substring(1) + '_commands"', function (err, rows, fields) {
            if (err)
                throw err;
            if (!rows[0]) {
                connection.query('CREATE TABLE ' + channel.substring(1) + '_commands (command VARCHAR(255), response VARCHAR(255))', function (err, rows, fields) {
                    console.log('Created new Commands table: ' + channel);
                });
            }
        });
    }
});

bot.addListener('notice', function (nick, to, text, message) {
    console.log(message);
    if (message.args[1].slice(0, 14) == 'The moderators') {
        var channel = message.args[0].substring(1);
        var moderatorList = message.args[1].split(',');
        console.log('Moderation Check: ' + channel);
        moderatorList[0] = moderatorList[0].replace('The moderators of this room are: ', '');
        for (var i = 0; i < moderatorList.length; i++) {
            moderatorList[i] = moderatorList[i].replace(' ', '');
        }
        connection.query('SHOW TABLES LIKE "' + channel + '_moderators"', function (err, rows, fields) {
            if (err)
                throw err;
            if (rows[0]) {
                connection.query('TRUNCATE TABLE ' + channel + '_moderators', function (err, rows, fields) {
                    for (var x = 0; x < moderatorList.length; x++) {
                        (function (x) {
                            connection.query('INSERT INTO ' + channel + '_moderators (moderator) VALUES ("' + moderatorList[x] + '")', function (err, rows, fields) {
                                if (err)
                                    throw err;
                            });
                        })(x);
                    }
                    connection.query('INSERT INTO ' + channel + '_moderators (moderator) values ("' + channel + '")', function (err, rows, fields) {
                        if (err)
                            throw err;
                    });
                });
            }
            else {
                connection.query('CREATE TABLE ' + channel + '_moderators (id INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY, moderator VARCHAR(50) NOT NULL)', function (err, rows, fields) {
                    if (err)
                        throw err;
                    for (var x = 0; x < moderatorList.length; x++) {
                        (function (x) {
                            connection.query('INSERT IGNORE INTO ' + channel + '_moderators (moderator) VALUES ("' + moderatorList[x] + '")', function (err, rows, fields) {
                                if (err)
                                    throw err;
                            });
                        })(x);
                    }
                    connection.query('INSERT INTO ' + channel + '_moderators (moderator) values ("' + channel + '")', function (err, rows, fields) {
                        if (err)
                            throw err;
                    });
                });
            }
        });
    }
    else if (message.args[1].slice(0, 12) == 'There are no') {
        var channel = message.args[0].substring(1);
        console.log('Moderation Check: ' + channel);
        connection.query('SHOW TABLES LIKE "' + channel + '_moderators"', function (err, rows, fields) {
            if (rows[0]) {
                connection.query('TRUNCATE TABLE ' + channel + '_moderators', function (err, rows, fields) {
                    connection.query('INSERT INTO ' + channel + '_moderators (moderator) values ("' + channel + '")', function (err, rows, fields) {
                        if (err)
                            throw err;
                    });
                });
            }
            else {
                connection.query('CREATE TABLE ' + channel + '_moderators (id INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY, moderator VARCHAR(50) NOT NULL)', function (err, rows, fields) {
                    if (err)
                        throw err;
                    connection.query('INSERT INTO ' + channel + '_moderators (moderator) values ("' + channel + '")', function (err, rows, fields) {
                        if (err)
                            throw err;
                    });
                });
            }
        });
    }
});

bot.addListener('message', function (from, to, message) {
    if (message.match(/[^\w\s!?.]{6,}/g)) {
        bot.say(to, '.timeout ' + from + ' 300');
        var modTable = to.substring(1) + '_moderators';
        connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
            if (!rows[0]) {
                console.log('ASCII Spam Detected: Not Moderator. Message: ' + message);
                bot.say(to, 'Timed out ' + from + ' for ascii spam (5 min).');
            }
            else {
            }
        });
    }
    if (message.match(/^!/)) {
        if (message == '!uptime') {
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
        else if (message == '!modcheck') {
            if (from == 'bovinity') {
                bot.part(to, function (channel, nick, reason, message) {
                    bot.join(to);
                });
            }
        }
        else if (message == '!join') {
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
        else if (message.match(/^!addcom /)) {
            var modTable = to.substring(1) + '_moderators';
            var commandsTable = to.substring(1) + '_commands';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
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
            });
        }
        else if (message.match(/^!delcom /)) {
            var modTable = to.substring(1) + '_moderators';
            var commandsTable = to.substring(1) + '_commands';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
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
            });
        }
        else if (message.match(/^!editcom /)) {
            var modTable = to.substring(1) + '_moderators';
            var commandsTable = to.substring(1) + '_commands';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
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
            });
        }
        else if (message == '!commands') {
            bot.say(to, 'Commands for this channel: http://www.bovinitydivinity.com/commands/' + to.substring(1));
        }
        else if (message.match(/^!topic /)) {
            var modTable = to.substring(1) + '_moderators';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
                    var parsedRequest = message.split(' ');
                    var newTopic = parsedRequest.slice(1).join(' ');
                    connection.query('SELECT auth_key FROM channels WHERE name = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0]) {
                            var options = {
                                url: 'https://api.twitch.tv/kraken/channels/' + to.substring(1) + '?channel[status]=' + newTopic + '&_method=put&oauth_token=' + rows[0]['auth_key'],
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
            });
        }
        else if (message.match(/^!game /)) {
            var modTable = to.substring(1) + '_moderators';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
                    var parsedRequest = message.split(' ');
                    var newGame = parsedRequest.slice(1).join(' ');
                    connection.query('SELECT auth_key FROM channels WHERE name = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0]) {
                            var options = {
                                url: 'https://api.twitch.tv/kraken/channels/' + to.substring(1) + '?channel[game]=' + newGame + '&_method=put&oauth_token=' + rows[0]['auth_key'],
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
            });
        }
        else {
            var currentChannel = to.substring(1) + '_commands';
            var commandArray = message.split(' ');
            connection.query('SELECT response FROM ' + currentChannel + ' WHERE command = "' + commandArray[0] + '" LIMIT 1', function (err, rows, fields) {
                if (err)
                    throw err;
                if (rows[0]) {
                    if (rows[0].response.indexOf('$(random)') != -1) {
                        var randomUser;
                        var userList = Object.keys(bot.chans[to].users);
                        var index = getRandomInt(0, userList.length - 1);
                        randomUser = userList[index];
                        rows[0].response = rows[0].response.replace('$(random)', randomUser);
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

// Begin Web interface
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

app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

app.get('*', function (req, res, next) {
    if (req.headers.host.slice(0, 3) != 'www') {
        res.redirect(301, 'http://www.' + req.headers.host + req.url);
    }
    else {
        next();
    }
});

app.post('/', function (req, res) {
    var userSession = req.session;
    if (req.body.op == "login") {
        function getHashValue(key) {
            var matches = req.body.clientHash.match(new RegExp(key + '=([^&]*)'));
            return matches ? matches[1] : null;
        }
        var hash = getHashValue('access_token');
        request('https://api.twitch.tv/kraken?oauth_token=' + hash, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var output = JSON.parse(body);
                var userSession = req.session;
                userSession.user = output['token']['user_name'];
                console.log('Website Login. User:' + userSession.user + ' - Auth_key:' + hash);
                connection.query('INSERT INTO channels (name, auth_key) VALUES ("' + userSession.user + '", "' + hash + '") ON DUPLICATE KEY UPDATE auth_key = "' + hash + '"', function (err, rows, fields) {
                    res.end('done');
                });
            }
        });
    }
    else if (req.body.op == 'functions') {
        var channel = userSession.user;
        var hsStatus = req.body.hearthstone;
        var csStatus = req.body.csgo;
        var lolStatus = req.body.league;
        connection.query('UPDATE channels SET league = "' + lolStatus + '" WHERE name = "' + channel + '" LIMIT 1', function (err, rows, fields) {
            connection.query('UPDATE channels SET csgo = "' + csStatus + '" WHERE name = "' + channel + '" LIMIT 1', function (err, rows, fields) {
                connection.query('UPDATE channels SET hearthstone = "' + hsStatus + '" WHERE name = "' + channel + '" LIMIT 1', function (err, rows, fields) {
                    res.end('done');
                });
            });
        });
    }
    else if (req.body.op == 'deleteCommand') {
        var command = req.body.command;
        var channel = userSession.user;
        var commandsTable = userSession.user + '_commands';
        connection.query('DELETE FROM ' + commandsTable + ' WHERE command = "' + command + '" LIMIT 1', function (err, rows, fields) {
            if (err)
                throw err;
            res.end('done');
        });
    }
    else if (req.body.op == 'editCommand') {
        var command = req.body.command;
        var response = req.body.response;
        var channel = userSession.user;
        var commandsTable = userSession.user + '_commands';
        connection.query('UPDATE ' + commandsTable + ' SET response = "' + response + '" WHERE command = "' + command + '" LIMIT 1', function (err, rows, fields) {
            if (err)
                throw err;
            res.end('done');
        });
    }
    else if (req.body.op == 'addTimer') {
        var announcement = req.body.announcement;
        var delay = req.body.delay;
        var channel = userSession.user;
        connection.query('INSERT INTO timers (response, timer, channel) VALUES ("' + announcement + '", "' + delay + '", "' + channel + '")', function (err, rows, fields) {
            if (err)
                throw err;
            res.end('done');
        });
    }
    else if (req.body.op == 'deleteTimer') {
        var timerID = req.body.timerID;
        connection.query('DELETE FROM timers WHERE ID = "' + timerID + '"', function (err, rows, fields) {
            if (err)
                throw err;
            res.end('done');
        });
    }
    else if (req.body.op == 'join') {
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
    }
    else if (req.body.op == 'part') {
        bot.part('#' + req.body.channel, function () {
            var channelList = Object.keys(bot.chans);
            console.log('Channel Part Request: ' + req.body.channel);
            res.send({ msg: 'is not' });
            res.end('done');
        });
    }
});

app.get('/', function (req, res) {
    console.log('Website Client Connection. IP: ' + req.connection.remoteAddress);
    console.log('User-Agent: ' + req.headers['user-agent'] + '\n');
    res.render('index.ejs', { clientid: auth.clientid, sessionName: req.session.user });
});

// The Draw Webpage.
app.get('/draw/:channel/drawframe.html', function (req, res) {
    res.render('drawframe.ejs');
});

// Public Commands Page, no user session.
app.get('/commands/:channel', function (req, res) {
    var tableName = req.params.channel + '_commands';
    var channel = req.params.channel;
    connection.query('SELECT response, timer FROM timers WHERE channel = "' + channel + '"', function (err, timers, fields) {
        connection.query('SELECT command, response FROM ' + tableName, function (err, commands, fields) {
            res.render('commandsPublic.ejs', { channel: channel, commands: commands, timers: timers });
        });
    });
});

app.get('/commands', function (req, res) {
    if (req.session.user) {
        var userSession = req.session;
        var tableName = userSession.user + '_commands';
        connection.query('SELECT id, response, timer FROM timers WHERE channel ="' + userSession.user + '"', function (err, timers, fields) {
            connection.query('SELECT command, response FROM ' + tableName, function (err, commands, fields) {
                res.render('commands.ejs', { channel: userSession.user, commands: commands, timers: timers });
            });
        });
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/viewers', function (req, res) {
    if (req.session.user) {
        var userSession = req.session;
        connection.query('SELECT viewer, credits FROM ' + userSession.user + '_viewers ORDER BY credits DESC', function (err, rows, fields) {
            res.render('viewers.ejs', { channel: userSession.user, viewers: rows });
        });
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/functions', function (req, res) {
    if (req.session.user) {
        var userSession = req.session;
        connection.query('SELECT hearthstone FROM channels WHERE name = "' + userSession.user + '"', function (err, hearthstone, fields) {
            connection.query('SELECT csgo FROM channels WHERE name = "' + userSession.user + '"', function (err, csgo, fields) {
                connection.query('SELECT league FROM channels WHERE name = "' + userSession.user + '"', function (err, league, fields) {
                    res.render('functions.ejs', { channel: userSession.user, hearthstone: hearthstone[0]['hearthstone'], csgo: csgo[0]['csgo'], league: league[0]['league'] });
                });
            });
        });
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/about', function (req, res) {
    var userSession = req.session;
    res.render('about.ejs', { channel: userSession.user });
});

app.get('/dashboard', function (req, res) {
    if (req.session.user) {
        var userSession = req.session;
        var channelList = Object.keys(bot.chans);
        if (channelList.indexOf('#' + userSession.user) != -1)
            var botStatus = 'is';
        else
            var botStatus = 'is not';
        res.render('dashboard.ejs', { channel: userSession.user, status: botStatus });
        res.end('done');
    }
    else
        res.render('index.ejs', { clientid: auth.clientid, sessionName: '' });
});

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.render('logout.ejs', {});
});

app.get('*', function (req, res) {
    var userSession = req.session;
    res.render('404.ejs', { status: 404, url: req.url });
});
// End Web Interface

//Cleaning up on exit
//process.stdin.resume();
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
/*
TODO: Finish website control panel - Add command controls, statistics, etc.
TODO: Link protection.
TODO: Extra content: Song requests/Games/Giveaways?
TODO: Move Commands and Timers to new DB system. (Maybe)
TODO: Error checking on variables.
*/
var auth = require('./auth');
var request = require('request');
var DB = require('mysql');
var irc = require('irc');
var connection = DB.createPool({
    connectionLimit: 20,
    host: auth.dbaddress,
    user: auth.dbname,
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
var binnieConfig = {
    port: 6667,
    server: 'irc.twitch.tv',
    nick: 'binnietv',
    password: auth.binnieoauth
};
var bot = new irc.Client(config.server, config.nick, { password: config.password, floodProtection: true, floodProtectionDelay: 1000, autoConnect: false });
var binnie = new irc.Client(binnieConfig.server, binnieConfig.nick, { password: binnieConfig.password, floodProtection: true, floodProtectionDelay: 1000, autoConnect: false });
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
bot.connect(function () {
    console.log('Logging in: irc.twitch.tv');
    bot.send('CAP REQ', 'twitch.tv/membership');
    //bot.send('CAP REQ', 'twitch.tv/tags');
    bot.send('CAP REQ', 'twitch.tv/commands');
    bot.join('#bovbot');
    bot.join('#binnietv');
    bot.join('#bovinity');
});
binnie.connect(function () {
    console.log('Logging BinnieTV client in.');
});
//Bot event Listeners
bot.addListener('error', function (message) {
    console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});
bot.addListener('join', function (channel, nick, message) {
    if (nick == 'bovbot')
        bot.say(channel, '.mods');
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
    if (message.match(/^!/)) {
        if (message == '!uptime') {
            request('https://api.twitch.tv/kraken/streams/' + to.substring(1), function (error, response, body) {
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
                    else
                        bot.say(to, 'Channel is not online.');
                }
            });
        }
        else if (message.match(/^!mod /)) {
            if (from == 'bovinity') {
                var parsedRequest = message.split(' ');
                var newMod = parsedRequest[1];
                binnie.say(to, '.mod ' + newMod);
                bot.say(to, 'Adding moderator: ' + newMod);
            }
            else
                bot.say(to, 'Haha, ' + from + ', no.');
        }
        else if (message.match(/^!unmod /)) {
            if (from == 'bovinity') {
                var parsedRequest = message.split(' ');
                var newMod = parsedRequest[1];
                binnie.say(to, '.unmod ' + newMod);
                bot.say(to, 'Removing moderator: ' + newMod);
            }
            else
                bot.say(to, 'Haha, ' + from + ', no.');
        }
        else if (message == "!banplz") {
            if (from == "bovinity")
                bot.say(to, 'Nah, Bov. You cool.');
            else
                binnie.say(to, ".ban " + from);
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
                console.log('Join request for channel: ' + from);
                bot.join('#' + from, function () { });
            }
        }
        else if (message.match(/^!addcom /)) {
            var modTable = to.substring(1) + '_moderators';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
                    var parsedRequest = message.split(' ');
                    var newCommand = parsedRequest[1];
                    var newResponse = parsedRequest.slice(2).join(' ');
                    if (!newCommand.match(/^!/) || !newResponse)
                        bot.say(to, 'Invalid command format. Must begin with ! and contain a suitable response.');
                    else {
                        connection.query('SELECT command FROM commands WHERE command = "' + newCommand + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                            if (err)
                                throw err;
                            if (rows[0])
                                bot.say(to, 'Command ' + newCommand + ' already exists, ignoring.');
                            else
                                connection.query('INSERT INTO commands (command, response, channel) VALUES ("' + newCommand + '","' + newResponse + '","' + to.substring(1) + '")', function (err, rows, fields) {
                                    if (err)
                                        throw err;
                                    bot.say(to, 'Command ' + newCommand + ' added.');
                                    connection.release;
                                });
                            connection.release;
                        });
                    }
                }
                else
                    bot.say(to, 'Sorry, only moderators can add commands.');
            });
        }
        else if (message.match(/^!delcom /)) {
            var modTable = to.substring(1) + '_moderators';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
                    var parsedRequest = message.split(' ');
                    var deletedCommand = parsedRequest[1];
                    connection.query('SELECT command FROM commands WHERE command = "' + deletedCommand + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0])
                            connection.query('DELETE FROM commands WHERE command = "' + deletedCommand + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                                if (err)
                                    throw err;
                                else
                                    bot.say(to, 'Deleting command ' + deletedCommand + '.');
                                connection.release;
                            });
                        else
                            bot.say(to, 'Command ' + deletedCommand + ' not found.');
                        connection.release;
                    });
                }
                else
                    bot.say(to, 'Sorry, only moderators can delete commands.');
            });
        }
        else if (message.match(/^!editcom /)) {
            var modTable = to.substring(1) + '_moderators';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
                    var parsedRequest = message.split(' ');
                    var editCommand = parsedRequest[1];
                    var newResponse = parsedRequest.slice(2).join(' ');
                    if (!parsedRequest[2]) {
                        bot.say(to, 'Invalid format, please specify a response for the given command.');
                    }
                    else {
                        connection.query('SELECT command FROM commands WHERE command = "' + editCommand + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                            if (err)
                                throw err;
                            if (rows[0])
                                connection.query('UPDATE commands SET response = "' + newResponse + '" WHERE command = "' + editCommand + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                                    if (err)
                                        throw err;
                                    else
                                        bot.say(to, 'Updated command ' + editCommand + '.');
                                    connection.release;
                                });
                            else
                                bot.say(to, 'Command ' + editCommand + ' not found.');
                            connection.release;
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
        else if (message.match(/^!promote /)) {
            var modTable = to.substring(1) + '_moderators';
            connection.query('SELECT moderator FROM ' + modTable + ' WHERE moderator = "' + from + '"', function (err, rows, fields) {
                if (rows[0]) {
                    var parsedRequest = message.split(' ');
                    var promotedUser = parsedRequest[1];
                    connection.query('SELECT viewer FROM viewers WHERE viewer = "' + promotedUser + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                        if (err)
                            throw err;
                        if (rows[0]) {
                            connection.query('UPDATE viewers SET regular = 1 WHERE viewer = "' + promotedUser + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
                                if (err)
                                    throw err;
                                bot.say(to, 'User ' + promotedUser + ' promoted to regular.');
                                connection.release;
                            });
                        }
                        else
                            bot.say(to, 'User ' + promotedUser + ' not found in user database. Possibly wait for next tracker to run?');
                        connection.release;
                    });
                }
                else {
                    bot.say(to, 'Sorry, only moderators can promote users.');
                    connection.release;
                }
            });
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
                        connection.release;
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
                        connection.release;
                    });
                }
                else {
                    bot.say(to, 'Sorry, only moderators can change the stream game.');
                }
            });
        }
        else {
            var commandArray = message.split(' ');
            connection.query('SELECT response FROM commands WHERE command = "' + commandArray[0] + '" AND channel = "' + to.substring(1) + '" LIMIT 1', function (err, rows, fields) {
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
                connection.release;
            });
        }
    }
});
//Timed Messages
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
                        var timerFire = newDate.valueOf() + (rows[x].timer * 60000);
                        var timeNow = new Date().valueOf() + (new Date().getTimezoneOffset() * 60000);
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
//Track viewers/award currency
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
                                        connection.release;
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
                                            connection.release;
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
    /*connection.query('UPDATE viewers SET regular = 1 WHERE credits >= 40', function (err, rows, fields) {
        if (err)
            throw err;
        connection.release;
    });*/
}
//Web interface
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
io.on('connection', function (socket) {
    socket.on('drawing', function (x, y, currX, currY, prevX, prevY) {
        io.emit('draw', x, y, currX, currY, prevX, prevY);
    });
    socket.on('erase', function () {
        io.emit('erase');
    });
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
    var userSession = req.session;
    res.render('index.ejs', { clientid: auth.clientid, sessionName: userSession.user });
});
app.get('/commands/*', function (req, res) {
    //Public page, no user session.
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    var channel = fullUrl.slice(41);
    connection.query('SELECT response, timer FROM timers WHERE channel ="' + channel + '"', function (err, timers, fields) {
        connection.query('SELECT command, response FROM commands WHERE channel ="' + channel + '"', function (err, commands, fields) {
            res.render('commandsPublic.ejs', { channel: channel, commands: commands, timers: timers });
        });
    });
});
app.get('/commands', function (req, res) {
    var userSession = req.session;
    connection.query('SELECT response, timer FROM timers WHERE channel ="' + userSession.user + '"', function (err, timers, fields) {
        connection.query('SELECT command, response FROM commands WHERE channel ="' + userSession.user + '"', function (err, commands, fields) {
            res.render('commands.ejs', { channel: userSession.user, commands: commands, timers: timers });
        });
    });
});
app.get('/viewers', function (req, res) {
    var userSession = req.session;
    connection.query('SELECT viewes, credits FROM ' + userSession.user + '_viewers', function (err, rows, fields) {
        if (!rows)
            var newRows = new Array();
        res.render('viewers.ejs', { channel: userSession.user, viewers: newRows });
    });
});
app.get('/functions', function (req, res) {
    var userSession = req.session;
    res.render('functions.ejs', { channel: userSession.user });
});
app.get('/about', function (req, res) {
    var userSession = req.session;
    res.render('about.ejs', { channel: userSession.user });
});
app.get('/dashboard', function (req, res) {
    var userSession = req.session;
    var channelList = Object.keys(bot.chans);
    if (channelList.indexOf('#' + userSession.user) != -1)
        var botStatus = 'is';
    else
        var botStatus = 'is not';
    res.render('dashboard.ejs', { channel: userSession.user, status: botStatus });
    res.end('done');
});
app.get('/logout', function (req, res) {
    req.session.destroy();
    res.render('logout.ejs', {});
});
app.get('*', function (req, res) {
    var userSession = req.session;
    res.render('404.ejs', { status: 404, url: req.url });
});
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
//# sourceMappingURL=server.js.map
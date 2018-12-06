module.exports = function checkTables(channel, connection) {
    if (channel.slice(0, 1) == '#')
        channel = channel.slice(1, channel.length);

    console.log('Checking database status for channel: ' + channel);

    connection.query('SHOW TABLES LIKE "' + channel + '_commands"', function (err, rows, fields) {
        if (err)
            throw err;
        if (!rows[0]) {
            connection.query('CREATE TABLE ' + channel + '_commands (command VARCHAR(255), response VARCHAR(255))', function (err, rows, fields) {
                console.log('Created new Commands table: ' + channel);
            });
        }
    });
    connection.query('SHOW TABLES LIKE "' + channel + '_chatlog"', function (err, rows, fields) {
        if (err)
            throw err;
        if (!rows[0]) {
            connection.query('CREATE TABLE ' + channel + '_chatlog (id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, viewer VARCHAR(50), text VARCHAR(500), color VARCHAR(20), badges VARCHAR(50))', function (err, rows, fields) {
                if (err)
                    throw err;
                console.log('Created new Chatlog table: ' + channel);
            });
        }
    });
    connection.query('SHOW TABLES LIKE "' + channel + '_viewers"', function (err, rows, fields) {
        if (err)
            throw err;
        if (!rows[0]) {
            connection.query('CREATE TABLE ' + channel + '_viewers (id INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY, viewer VARCHAR(50) NOT NULL UNIQUE, credits INT UNSIGNED, regular INT UNSIGNED)', function (err, rows, fields) {
                if (err)
                    throw err;
                console.log('Created new Viewers table: ' + channel);
            });
        }
    });
    connection.query('SELECT name FROM channels WHERE name = "' + channel + '"', function (err, rows, fields) {
        if (err)
            throw err;
        if(!rows[0]) {
            connection.query('INSERT INTO channels (name) VALUES ("' + channel + '")', function (err, rows, fields) {
                if (err)
                    throw err;
            });
        }
    });
}
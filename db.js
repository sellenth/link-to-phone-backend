require('dotenv').config();
const mysql = require('mysql');

const connection = mysql.createConnection(process.env.NODE_ENV === 'production' ? {
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    port: process.env.RDS_PORT,
    database: process.env.RDS_DB_NAME
} : {
    host: process.env.MOCK_DB_HOST,
    user: process.env.MOCK_DB_USER,
    password: process.env.MOCK_DB_PASSWORD,
    port: process.env.MOCK_DB_PORT,
    database: process.env.MOCK_DB_DATABASE
});

function connectToDB() {
    connection.connect(function (err) {
        if (err) {
            console.error('Database connection failed: ' + err.stack);
            return false;
        }
        console.log('Connected to database.');
        return true;
    });
}

module.exports = { connection, connectToDB }
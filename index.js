require('dotenv').config() 
const express = require('express');
const app = express();
app.use(express.json());
const mysql = require('mysql');
const argon2 = require('argon2');

const connection = mysql.createConnection({
  host     : process.env.RDS_HOSTNAME,
  user     : process.env.RDS_USERNAME,
  password : process.env.RDS_PASSWORD,
  port     : process.env.RDS_PORT,
  database : process.env.RDS_DB_NAME
});

app.post('/incomingSMS', (req, res) => {
    console.log(req.body);
    res.status(200).send();
})

app.get('/', (req, res) => {
    res.send("Welcome, hello.")
})

/*
try {
  if (await argon2.verify("<big long hash>", "password")) {
    // password match
  } else {
    // password did not match
  }
} catch (err) {
  // internal failure
}
*/

function createUserQuery(res, phoneNumber, nationCode, pwHash){
    connection.query(`INSERT INTO users (phoneNumber, nationCode, password) VALUES (${phoneNumber}, ${nationCode}, "${pwHash}")`,
        function (err, rows, fields) {
        if (err) {
            console.log(err)
            res.status(500)
            res.send('Server failed to add user, see log');
        } else {
            console.log(rows);
            res.status(200);
            res.send('User successfully created.')
        }
    });
}

app.post('/create-user', async (req, res, err) => {
    const {phoneNumber, nationCode, password} = req.body;
    if (!phoneNumber, !nationCode, !password){
        res.status(400);
        res.send('Request must specify phone number, nation code, and password');
    } else {
        try {
            const pwHash = await argon2.hash(password);
            createUserQuery(res, phoneNumber, nationCode, pwHash)
        } catch (err) {
            console.log(err);
            res.status(500)
            res.send('Server error, please try again later');
        }

    }
})

const port = process.env.port || 3000;
app.listen(port, () => {
    console.log("Listening on port: ", port);

    connection.connect(function(err) {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
    });

})
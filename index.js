require('dotenv').config();
const express = require('express');
const { urlencoded } = require('body-parser');
const app = express();
app.use(express.json());
app.use(urlencoded({ extended: false }));

const mysql = require('mysql');
const argon2 = require('argon2');
const {phone} = require('phone');
const twilioClient = require('twilio')()
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const connection = mysql.createConnection({
  host     : process.env.RDS_HOSTNAME,
  user     : process.env.RDS_USERNAME,
  password : process.env.RDS_PASSWORD,
  port     : process.env.RDS_PORT,
  database : process.env.RDS_DB_NAME
});

app.get('/', (req, res) => {
    res.send("Welcome, hello. v1")
})

function provideHelpMsg(phoneNumber){
    twilioClient.messages
    .create({body: 'Invalid command. Respond to this text with STOP to opt-out of future messages.', from: twilioNumber, to: phoneNumber})
}

function issueVerificationMsg(phoneNumber){
    twilioClient.messages
    .create({body: 'Welcome to the link-to-phone service. Respond to this text with ACCEPT to verify your account.', from: twilioNumber, to: phoneNumber})
}

function issueUserRequestMsg(phoneNumber, body){
    twilioClient.messages
    .create({body: body, from: twilioNumber, to: phoneNumber})
}

function confirmVerification(phoneNumber){
    twilioClient.messages
    .create({body: "You've successfully verified your account, enjoy!", from: twilioNumber, to: phoneNumber})
}

app.post('/incomingSMS', (req, res) => {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const incomingNum = phone(req.body.From);
    if (incomingMsg === "accept"){
        connection.query(`UPDATE users set verified = 1 where phoneNumber = "${incomingNum.phoneNumber}"`,
        function (err, rows) {
            if (err){
                console.log(err)
                res.status(500)
                res.send("No user exists with that phone number");
            } 
            if (rows.affectedRows === 0) {
                console.log('No user exists with phone number', incomingNum.phoneNumber)
                res.status(200).send();
            }
            else {
                console.log(rows);
                confirmVerification(incomingNum.phoneNumber);
                res.status(200);
                res.send("User verified")
            }
        });
    } else {
        provideHelpMsg(incomingNum.phoneNumber);
        res.status(200).send();
    }
})

app.post('/outgoingSMS', (req, res) => {
    const {phoneNumber, password, msgContent} = req.body;
    connection.query(`SELECT password FROM users WHERE phoneNumber = "${phoneNumber}" AND verified = 1;`,
        async (err, rows) => {
            if(err){
                console.log(err);
                res.status(500).send('Something went wrong, see log');
            } else if (rows.length === 0){
                res.status(200).send("Phone number doesn't exist or isn't verified");
            } else {
                const hashedPW = rows[0].password;
                try {
                    if (await argon2.verify(hashedPW, password)) {
                        issueUserRequestMsg(phoneNumber, msgContent);                    
                        res.status(200).send("Successfully sent msg to", phoneNumber);
                    } else {
                        res.status(401).send("Invalid password");
                    }
                } catch (err) {
                    console.log(err);
                    res.status(500).send('Something went wrong, see log');
                }
            }

        }
    )
     
})

function createUserQuery(res, phoneNumber, pwHash){
    connection.query(`INSERT INTO users (phoneNumber, password) VALUES ("${phoneNumber}", "${pwHash}")`,
        function (err, rows) {
        if (err) {
            console.log(err)
            if (err.code === 'ER_DUP_ENTRY'){
                res.status(500)
                res.send('A user already exists with that phone number');
            } else {
                res.status(500)
                res.send('Server failed to add user, see log');
            }
        } else {
            console.log(rows);
            issueVerificationMsg(phoneNumber);
            res.status(200);
            res.send('User successfully created.')
        }
    });
}

app.post('/create-user', async (req, res, err) => {
    const {phoneNumber, password} = req.body;
    const parsedNumber = phone(phoneNumber);
    if (!phoneNumber || !parsedNumber.isValid || !password){
        res.status(400);
        res.send('Request must specify valid phone number and password');
    } else {
        try {
            const pwHash = await argon2.hash(password);
            createUserQuery(res, parsedNumber.phoneNumber, pwHash)
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
require('dotenv').config();
process.env.NODE_ENV = process.argv[2];

const express = require('express');
const path = require('path')
const cors = require('cors');
const { urlencoded } = require('body-parser');
const app = express();
const {connection} = require('./db')
app.use(cors('http://localhost:3000'));
app.use(express.json());
app.use(urlencoded({ extended: false }));

const argon2 = require('argon2');
const { phone } = require('phone');

const twilioClient = require('twilio')()
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

const favicon = require('serve-favicon')
app.use(favicon(path.join(__dirname, '../build/favicon.ico')))

app.use('/', express.static(path.join(__dirname, '../build')));

function sendTwilioMsg(msg, phoneNumber){
    if (['production', 'development'].includes(process.env.NODE_ENV)){
        twilioClient.messages
            .create({ body: msg, from: twilioNumber, to: phoneNumber })
    }
}

function provideHelpMsg(phoneNumber) {
    sendTwilioMsg('Invalid command. Respond to this text with STOP to opt-out of future messages.', phoneNumber);
}

function issueVerificationMsg(phoneNumber) {
    sendTwilioMsg('Welcome to the link-to-phone service. Respond to this text with ACCEPT to verify your account.', phoneNumber);
}

function issueUserRequestMsg(phoneNumber, body) {
    sendTwilioMsg(body, phoneNumber);
}

function confirmVerification(phoneNumber) {
    sendTwilioMsg('You\'ve successfully verified your account, enjoy!', phoneNumber);
}

app.post('/incomingSMS', (req, res) => {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const incomingNum = phone(req.body.From);
    if (incomingMsg === "accept") {
        connection.query(`UPDATE users set verified = 1 where phoneNumber = "${incomingNum.phoneNumber}"`,
            function (err, rows) {
                if (err) {
                    console.log(err)
                    res.status(500)
                    res.send("Something went wrong, see log");
                }
                if (rows.affectedRows === 0) {
                    console.log('No user exists with phone number', incomingNum.phoneNumber)
                    res.status(404).send();
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
    const { phoneNumber, password, msgContent } = req.body;
    const numberParsed = phone(phoneNumber);
    if (!phoneNumber || !numberParsed.isValid || !password) {
        res.status(401).send("Invalid phone number or password");
    } else {
        connection.query(`SELECT password FROM users WHERE phoneNumber = "${numberParsed.phoneNumber}" AND verified = 1;`,
            async (err, rows) => {
                console.log(rows)
                if (err) {
                    console.log(err);
                    res.status(500).send('Something went wrong, see log');
                } else if (rows.length === 0) {
                    res.status(404).send("Phone number doesn't exist or isn't verified");
                } else {
                    const hashedPW = rows[0].password;
                    try {
                        if (await argon2.verify(hashedPW, password)) {
                            issueUserRequestMsg(numberParsed.phoneNumber, msgContent);
                            res.status(200).send(`Successfully sent msg to ${numberParsed.phoneNumber}`);
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
    }

})

function createUserQuery(res, phoneNumber, pwHash) {
    connection.query(`INSERT INTO users (phoneNumber, password) VALUES ("${phoneNumber}", "${pwHash}")`,
        function (err, rows) {
            if (err) {
                console.log(err)
                if (err.code === 'ER_DUP_ENTRY') {
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
    const { phoneNumber, password } = req.body;
    const parsedNumber = phone(phoneNumber);
    if (!phoneNumber || !parsedNumber.isValid || !password) {
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


module.exports = app;
require('dotenv').config();
const fs = require('fs')
const request = require('supertest');
const app = require('../app');
const { connection, connectToDB } = require('../db');

const validatedNumber = "+1 541 555 0100"
const unvalidatedNumber = "+1 541 555 0101"

before(() => {
  connectToDB();
  connection.query(`drop table if exists users;`);
  const createUserTableSQL = fs.readFileSync('./usersTable.sql').toString();
  connection.query(createUserTableSQL);
})

after(() => {
  connection.end();
});

describe("Test the root path", () => {
  it("should response the GET method", () => {
    return request(app).get("/").expect(200);
  });
});

describe("Test the create user path", () => {
  it("should create a user", () => {
    return request(app).post("/create-user").send({ phoneNumber: validatedNumber, password: "testing:)" }).expect(200);
  });

  it("should not create a user if phone number already exists", () => {
    return request(app).post("/create-user").send({ phoneNumber: validatedNumber, password: "testing:)" }).expect(500);
  });

  it("should create a second user", () => {
    return request(app).post("/create-user").send({ phoneNumber: unvalidatedNumber, password: "testing:)" }).expect(200);
  });

  it("should not create a user if malformed phone number (1)", () => {
    return request(app).post("/create-user").send({ phoneNumber: "a", password: "testing:)" }).expect(400);
  });

  it("should not create a user if malformed phone number (2)", () => {
    return request(app).post("/create-user").send({ phoneNumber: "+1 541 555 010a", password: "testing:)" }).expect(400);
  });

  it("should not create a user if malformed phone number (3)", () => {
    return request(app).post("/create-user").send({ phoneNumber: "#!)(*", password: "testing:)" }).expect(400);
  });

  it("should not create a user if no empty phone number provided", () => {
    return request(app).post("/create-user").send({ phoneNumber: "", password: "testing:)" }).expect(400);
  });
});

describe("Test server receives text from user", () => {
  it("should verify a pre-existing user's ACCEPT message", () => {
    return request(app).post("/incomingSMS").send({ From: validatedNumber, Body: "Accept" }).expect(200);
  });
  it("should not verify a non-existent user's ACCEPT message", () => {
    return request(app).post("/incomingSMS").send({ From: "+1 012 345 6789", Body: "Accept" }).expect(404);
  });
  it("should simply allow user's non ACCEPT message", () => {
    return request(app).post("/incomingSMS").send({ From: validatedNumber, Body: "???" }).expect(200);
  });
});

describe("Server sends text to user", () => {
  it("should send text to verified user", () => {
    return request(app).post("/outgoingSMS").send({ phoneNumber: validatedNumber, password: "testing:)", msgContent: "content" }).expect(200);
  });
  it("should not send text to user if using wrong password", () => {
    return request(app).post("/outgoingSMS").send({ phoneNumber: validatedNumber, password: "invalid", msgContent: "content" }).expect(401);
  });
  it("should not send text to non-existent user", () => {
    return request(app).post("/outgoingSMS").send({ phoneNumber: "+1 541 555 0199", password: "testing:)", msgContent: "content" }).expect(404);
  });
  it("should not send text to non-validated user", () => {
    return request(app).post("/outgoingSMS").send({ phoneNumber: unvalidatedNumber, password: "testing:)", msgContent: "content" }).expect(404);
  });
});
const app = require('./app')
const {connectToDB} = require('./db')
const port = process.env.port || 3001;

app.listen(port, () => {
    console.log("Listening on port: ", port);

    connectToDB();

})
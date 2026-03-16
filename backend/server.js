//Setting up a basic express server
const express = require('express');

//Creating an instance of express
const app = express();

//Allowing the server to parse JSON bodies
app.use(express.json());

//Listening on port 3000
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

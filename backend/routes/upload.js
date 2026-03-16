

app.post('/presign', (req, res) => {

});

app.post('/documents', (req, res) => {
    
});

app.post('/documents/:id/extract', (req, res) => {

});

app.get('/documents/:id/result', (req, res) => {
    
});



//Routes needed
    //Post
        //Client sends a image we need to pass through textract
    //Get
        //Client wants to get result->Should show automatically
        //Client wants to show past result -> Get based on title
POST /uploads/presign
POST /documents
POST /documents/:id/extract
GET /documents/:id/result

Each route:

1 receives request
2 validates input
3 calls AWS service
4 returns result
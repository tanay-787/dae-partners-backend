"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var app = express();
var port = parseInt(process.env.PORT) || process.argv[3] || 8080;
app.get('/api', function (req, res) {
    res.json({ "msg": "Hello world" });
});
app.listen(port, function () {
    console.log("Listening on http://localhost:".concat(port));
});
//# sourceMappingURL=index.js.map
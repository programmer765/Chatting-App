import express from "express";
import * as dotenv from "dotenv";
import mongoose from "mongoose";
import Messages, { Room } from "./MessagesDB.js";
import cors from "cors";
import _ from "lodash";
import Pusher from "pusher";
dotenv.config();

const app = express();
const port = process.env.PORT || 9000;

const pusher = new Pusher({
  appId: "1540016",
  key: process.env.key,
  secret: process.env.secret,
  cluster: "ap2",
  useTLS: true,
});

const corsOptions = {
  origin: [
    "https://dainty-zuccutto-0a29a5.netlify.app",
    "http://localhost:3000",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(express.json());
app.use(cors(corsOptions));

app.all((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "Content-Type",
    "Authorization"
  );
  next();
});

// mongodb url
const url = `mongodb+srv://admin:${process.env.password}@cluster0.dpjstd6.mongodb.net/whatsappdb?retryWrites=true&w=majority`;

mongoose.set("strictQuery", false);
mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// pusher connection (syncs frontend with backend when there is a change in backend)
const db = mongoose.connection;
db.once("open", () => {
  console.log("db is conected");
  const msgCollection = db.collection("rooms");
  const changeStream = msgCollection.watch();
  changeStream.on("change", (change) => {
    // console.log(change);
    if (change.operationType === "insert") {
      const roomDetails = change.fullDocument;
      pusher.trigger("rooms", "inserted", {
        name: roomDetails.name,
      });
    } else if (change.operationType === "update") {
      // console.log(change.updateDescription);
      const messageDetails = Object.values(
        change.updateDescription.updatedFields
      );
      const check = Array.isArray(messageDetails[1]);
      pusher.trigger("messages", "update", {
        message: check
          ? messageDetails[1][0].message
          : messageDetails[1]?.message,
        name: check ? messageDetails[1][0].name : messageDetails[1]?.name,
        timestamp: check
          ? messageDetails[1][0].timestamp
          : messageDetails[1]?.timestamp,
        uid: check ? messageDetails[1][0].uid : messageDetails[1]?.uid,
      });
    } else {
      console.log("Error");
    }
  });
});

// makes root directory
app.get("/", (req, res) => res.status(200).send("hello world"));

// retreives all db in the current collection

app.get("/all/db", (req, res) => {
  Room.find((err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(data);
    }
  });
});

// retreives all the messages in the current db
app.get("/messages/sync", (req, res) => {
  res.status(201).send("ok");
});

app.get("/messages/sync/:dbName", (req, res) => {
  const dbName = _.kebabCase(req.params.dbName);
  Room.findOne({ name: dbName }, (err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(data.messages);
    }
  });
});

// pushes new message in db
app.post("/messages/new/:dbName", (req, res) => {
  const newMessage = req.body;
  const dbName = _.kebabCase(req.params.dbName);
  const message = new Messages({
    message: newMessage.message,
    name: newMessage.name,
    timestamp: newMessage.timestamp,
    uid: newMessage.uid,
  });
  Room.findOne({ name: dbName }, (err, found) => {
    if (!err) {
      found.messages.push(message);
      found.save();
      res.status(201).send("Operation Succesful");
    } else {
      res.status(500).send("Operation Unsuccessful");
    }
  });
});

// creates new db
app.post("/new/db/:newDbName", (req, res) => {
  const newDbName = _.kebabCase(req.params.newDbName);
  Room.findOne({ name: newDbName }, (err, found) => {
    if (!err) {
      if (!found) {
        const room = new Room({
          name: newDbName,
          messages: [],
        });
        room.save();
      } else {
        res.send("Already exists");
      }
    } else {
      res.status(500).send(err);
    }
  });
  res.status(201).send(newDbName);
});

// establishes connection
app.listen(port, () => console.log(`Listening on localhost:${port} `));

import mongoose from "mongoose";

const messageSchema = mongoose.Schema({
  message: String,
  name: String,
  timestamp: String,
  uid: String,
});

export default mongoose.model("messageContent", messageSchema);

const roomSchema = mongoose.Schema({
  name: String,
  messages: [messageSchema],
});

export const Room = mongoose.model("room", roomSchema);

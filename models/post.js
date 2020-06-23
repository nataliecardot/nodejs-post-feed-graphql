const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  // When a new object is added to db, MongoDB will add a timestamp; automatically get a createdAt and updatedAt timestamp
  {
    timestamps: true,
  }
);

// Exporting model based on schema, not schema itself. model() method allows for creating model based on schema
module.exports = mongoose.model('Post', postSchema);

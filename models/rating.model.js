import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema({
    course: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Course'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
        ref: 'User'
    },
    stars: {
        type: Number,
        required: true,
        default: 5
    },
    review: {
        type: String,
        default: ""
    }
})

export const Rating = mongoose.model("Rating", ratingSchema)
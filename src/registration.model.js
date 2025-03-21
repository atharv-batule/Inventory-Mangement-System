import mongoose from 'mongoose'

const userSchema= new mongoose.Schema({
    // id:{
    //     type:objectId,
    //     unique:true
    // },
    name:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true,
        hashed:true
    },
    role: {
        type: String,
        enum: ["Buyer", "Supplier","Admin"],
        required: true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:Number,
        required:true,
        unique:true
    },

    organization:{
        type:String,

    }

},{timestamps:true})


const collection=mongoose.model('user',userSchema)
export default collection
const Joi = require('joi');
const passport = require('passport');

const signUpValidation = (req,res,next)=>{
    const schema = Joi.object({
        name : Joi.string().required(),
        email : Joi.string().email().required(),
        password : Joi.string().required(), // <-- FIXED
    });

    const { error } = schema.validate(req.body);
    if(error){
        return res.status(400)
                .json({message : "bad request", error});
    }
    next();
}


const loginValidation = (req,res,next)=>{
    const schema = Joi.object({
        email : Joi.string().email().required(),
        password : Joi.string().required(),
    });

    const { error } = schema.validate(req.body);
    if(error){
        return res.status(400)
                .json({message : "bad request", error});
    }
    next();
}

module.exports = {signUpValidation,loginValidation};
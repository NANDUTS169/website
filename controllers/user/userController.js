const User = require("../../models/userSchema");
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt');
const { response } = require("express");

const loadHomepage = async(req,res) => {
    try {
        const user = req.session.user;
        console.log(user)
        if(user){
            const userData = await User.findOne({_id:user});
            console.log(userData);
            res.render("home",{user:userData})
        }else{
            return res.render('home');
        }
        
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("Server error")
    }
}

const pageNotFound = async (req,res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadsignup = async(req,res)=> {
    try {
        return res.render("signup")
    } catch (error) {
        console.log("Signup page not found")
        res.status(500).send("server error")
    }  
}

// const signup = async(req,res) => {
//     const {name,email,phone,password} = req.body;

//     try {

//         const newUser = new User({name,email,phone,password});
//         console.log(newUser)
//         await newUser.save();
//         return res.redirect("/")

//     } catch (error){
//         console.error("Error for save user",error);
//         res.status(500).send("Internal server error");
//     }
// }


// function generateOtp(){
//     return Math.floor(100000) + Math.random()*(900000).toString();
// }

function verificationOtp(){ 
    const otp = otpGenerator.generate(6,{
                digits:true,
                lowerCaseAlphabets:false,
                upperCaseAlphabets:false,
                specialChars:false
})
     return otp;
}

async function sendVerificationEmail(email,otp){

    console.log(email,otp,'this is from send verification email')
    try{
        const transporter = nodemailer.createTransport({

            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            },
            // logger: true,
            // debug: true,
            
        })
        console.log("NODEMAILER_EMAIL:", process.env.NODEMAILER_EMAIL);
        console.log("NODEMAILER_PASSWORD:", process.env.NODEMAILER_PASSWORD);


        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`
        })

        return info.accepted.length > 0

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async(req,res) => {
    try{

        const {name,email,password,confirmPassword} = req.body;
        
        if(password !== confirmPassword){
            return res.render("signup",{message: "Passwords donot match"});
        }

        const findUser = await User.findOne({email});

        if(findUser){
            return res.render("signup",{message: "User with this email already exists..!"});
        }

        const otp = await verificationOtp()

        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = {name,email,password};

        res.render("verifyotp");
        console.log("OTP Sent",otp);

    } catch (error) {

        console.error("Signup error: ",error)
        res.redirect("/pageNotFound")
    }
}


// const loadLogin = async(req,res) => {
//     try {
//         res.render("login")
//     } catch (error) {
//         res.status(500).send("Internal server error");
//     }
// }

const loadLogin = async(req,res) => {
    console.log("funtion invoked... - loadLogin")
    try {
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const login = async (req,res) => {

    try {
        console.log("Hello...........login function invoked...")

        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render("login",{message: "User not found"});
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by the admin"})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render("login",{message: "Incorrect Password"});
        }
        req.session.user = findUser._id;
        res.redirect("/")

    } catch (error) {
        console.error("login error",error);
        res.render("login",{message: "Login failed.. Please try again later.."});
    }
}

const productdetail = async(req,res) => {
    try{
        res.render("product-detail")
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const securePassword = async (password) => {
    try {
        
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash;

    } catch (error) {
        
    }
}

const verifyOtp = async (req,res) => {
    try{

        const {otp} = req.body;
        console.log(otp)

        if(otp === req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({success:true, redirectUrl:"/"})

        }else{
            res.status(400).json({success:false, message: "Invalid OTP, Please try again"})
        }
    } catch (error) {
        console.error("Error Verifying OTP",error);
        res.status(500).json({success: false, message: "An error occured"})
    }
}

const resendotp = async (req,res) => {
    try {
        console.log("function invoked.... - resendotp")
        const {email} = req.session.userData;
        console.log(email)

        if(!email){
            return response.status(400).json({success: false, message: "Email not found in session"})
        }
        const otp = verificationOtp();
        console.log(otp)
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);

            if(emailSent){
                console.log("Resent OTP:",otp);
                res.status(200).json({success: true, message: "OTP resent successfully"});
            }else{
                res.status(500).json({success: false, message: "Failed to resend OTP. PLease try again.."});
            }

    } catch (error) {
        
        console.error("Error sending OTP",error);
        res.status(500).json({success: false, message: "Internal server error. Please try again"});
    }
} 

const logout = async(req,res) => {
    try {
        req.session.destroy((err) => {
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login");
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/PageNotFound");
    }
}



module.exports = {
    loadHomepage,
    pageNotFound,
    loadsignup,
    signup,
    loadLogin,
    login,
    productdetail,
    verifyOtp,
    resendotp,
    logout,
}
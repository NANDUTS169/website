const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session"); 
const { generate } = require("otp-generator");
const fs = require("fs");
const path = require('path');


function generateOtp(){
    const digits = "1234567890";
    let otp = "";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];  
    }
    return otp;
}

const sendVerificationEmail = async(email,otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your otp for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4><br></b>` 
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("email sent:",info.messageId);
        return true;
        
    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;

    } catch (error) {
        console.error(error);
    }
}


const getForgotPassPage = async (req,res) => {
    try {
        res.render("forgot-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const forgotEmailValid = async(req,res) => {
    try {
        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("OTP is:",otp);
            }else{
                res.json({success:false, message:"Failed to send OTP, Please try again.."});
            }
        }else{
            res.render("forgot-password",{
                message: "User with this email doesnot exist"
            });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const verifyForgotPassOtp = async (req,res) => {
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching."});
        }
    } catch (error) {
        res.status(500).json({success:false,message:"An error occured. PLease try again.."});
    }
}

const getResetPassPage = async (req,res) => {
    try {
        res.render("reset-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const resendOtp = async(req,res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending otp to email",email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP: ",otp);
            res.status(200).json({success:true,message:"Resend OTP Successful.."});
        }
    } catch (error) {
        console.error("Error in resend OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error"});
    }
}

const postNewPassword = async (req,res) => {
    try {
        const {newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(newPass1 === newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/login");
        }else{
            res.render("reset-password",{message:"Passwords donot match"});
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const getUserProfile = async(req,res) => {

    try {
        console.log("Get user Profile function invoked..");
        const userId = req.session.user;
        console.log("User in the getprofile page",req.session.user);
        const user = await User.findById(userId).lean();
        console.log(user);
        if(!user) return res.redirect("/login");

        const addressDoc = await Address.findOne({ UserId: userId, "address.isActive" : true}).lean();
        console.log("AddressDoc : ",addressDoc);
        const addresses = addressDoc?.address || [];
        console.log("Addresses passing to the profile page : ",addresses);

        const orders = await Order.find({address: userId})
        .populate("orderedItems.product")
        .sort({createdOn: -1})
        .limit(5)
        .lean();

        res.render("userProfile",{
            user,
            addresses,
            orders
        });
       
    } catch (error) {
        console.log("Error loading userProfile page",error);
        res.redirect("/pageNotFound");
    }
};


const updateUserProfile = async (req,res) => {
    console.log("Update profile function invoked..")
    try {
        const userId = req.session.user;
        const {name,email,phone,gender,birthdate} = req.body;

        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({success:false,message:"user not found"});
        }
        
        user.name = name?.trim() || user.name;
        user.email = email?.trim() || user.email;
        user.phone = phone?.trim() || user.phone;
        user.gender = gender || user.gender;
        user.birthdate = birthdate || user.birthdate;

        if(req.file) {
            if(user.profileImage){
                const oldPath = path.join(__dirname, '../../public',user.profileImage);
                if(fs.existsSync(oldPath)) {
                    fs.unlink(oldPath,(err) => {
                        if(err) conosle.log("Failed to delete old profile image",error);
                        else console.log("Old profile image deleted");
                    });
                }
            }
            user.profileImage = `/uploads/profile/${req.file.filename}`;
        }
        
        await user.save();
        res.json({success: true, message: "Profile updated Successfully",user});

    } catch (error) {
        console.error("Profile update failed:",error);
        res.status(500).json({success:false, message: "Server error"});
    }
};


const changePassword = async (req,res) => {
    try {
        const userId = req.session.user || req.user._id;
        const {currentPassword, newPassword} = req.body;

        const user = await User.findById(userId);
        if(!user) {
            return res.status(404).json({error: "User not found"});
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if(!isMatch) {
            return res.status(400).json({error: "Current password is incorrect"});
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        await user.save();

        res.json({message:"Password changed successfully"});

    } catch (error) {
        console.error(error);
        res.status(500).json({error:"Server error"});
    }
}

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    getUserProfile,
    updateUserProfile,
    changePassword,
};

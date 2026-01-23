import userServices from '../services/userServices.js';
import userModel from '../models/userModel.js';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import blackListTokenModel from '../models/blackListTokenModel.js';
import dotenv from 'dotenv';
import meetingModel from '../models/meetingModel.js';
dotenv.config();

const registerUser = async (req, res)=>{
    try{
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({ 
                success: false,
                errors: errors.array()
            });
        }
        const { name, email, password } = req.body;
        console.log(req.body);
        if(!name || !email || !password){
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        const isUserAlreadyExists = await userModel.findOne({ email });
        if(isUserAlreadyExists){
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }
        const user = await userServices.createUser({ name, email, password });
        const token = jwt.sign({
            id: user._id,
            email: user.email
        }, process.env.JWT_SECRET,
        {
            expiresIn: '2h'
        });
        console.log(process.env.JWT_SECRET);
        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            token,
            data: {
                name: user.name,
                email: user.email,
            }
        });
    }catch(err){
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const loginUser = async (req, res)=>{
    try{
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({
                success: false,
                errors: errors.array()
            })
        }
        const {email, password} = req.body;
        if(!email || !password){
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        const user = await userModel.findOne({ email });
        if(!user){
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if(!isPasswordValid){
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        const token = jwt.sign({
            id: user._id,
            email: user.email
        }, process.env.JWT_SECRET,
        {
            expiresIn: '2h'
        });
        return res.status(200).json({
            success: true,
            message: 'User logged in successfully',
            token,
            data: {
                name: user.name,
                email: user.email
            }
        });
    }catch(err){
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserProfile = async(req,res)=>{
    try{
        res.status(200).json({
            success: true,
            message: 'User profile fetched successfully',
            data: req.user
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success: false,
            message: 'Error in fetching user profile'
        });
    }
};

const logoutUser = async(req,res)=>{
    try{        
        const token = req.cookies.token || 
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        
        if(!token) {
            return res.status(400).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        await blackListTokenModel.create({ token });
        res.clearCookie('token');
        
        return res.status(200).json({
            success: true,
            message: 'User logged out successfully'
        });
    }catch(err){
        console.log(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserHistory = async(req,res)=>{
    try{
        // Use the authenticated user from req.user (set by authMiddleware)
        const user = req.user;
        
        if(!user){
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get pagination parameters from the request
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Get all meetings where user is the host OR a participant
        const meetings = await meetingModel.find({
            $or: [
                { hostId: user._id },
                { participants: user._id }
            ]
        })
        .sort({ createdAt: -1 }) // Sort by creation date, newest first
        .skip(skip)
        .limit(limit);
        
        // Get total count for pagination info
        const totalCount = await meetingModel.countDocuments({
            $or: [
                { hostId: user._id },
                { participants: user._id }
            ]
        });
        
        return res.status(200).json({
            success: true,
            message: 'User history fetched successfully',
            data: meetings,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                hasMore: skip + meetings.length < totalCount
            }
        });

    }catch(err){
        console.log(err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const addToHistory = async (req, res) => {
    try {
        // Use the authenticated user from req.user (set by authMiddleware)
        const user = req.user;
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Validate required fields
        const { title, startTime, endTime, meetingLink } = req.body;
        if (!title || !startTime || !endTime || !meetingLink) {
            return res.status(400).json({
                success: false,
                message: 'Missing required meeting fields'
            });
        }
        
        // Extract the meeting ID from the meetingLink
        let meetingId;
        try {
            const url = new URL(meetingLink);
            const pathParts = url.pathname.split('/');
            meetingId = pathParts[pathParts.length - 1];
        } catch (err) {
            // If not a valid URL, use the last part after the last slash
            meetingId = meetingLink.split('/').pop();
        }
        
        // Check if meeting with this meetingId already exists
        const existingMeeting = await meetingModel.findOne({ meetingId });
        
        if (existingMeeting) {
            // If meeting exists, return it without creating a new one
            return res.status(200).json({
                success: true,
                message: 'Meeting already exists in history',
                data: existingMeeting
            });
        }
        
        // Create new meeting with meetingId
        const meeting = await meetingModel.create({
            ...req.body,
            meetingId, // Store the public meeting ID string
            hostId: user._id,
            status: req.body.status || 'scheduled'
        });
        
        return res.status(201).json({
            success: true,
            message: 'Meeting added to history successfully',
            data: meeting
        });
    } catch (err) {
        console.error("Error adding meeting to history:", err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error: ' + err.message
        });
    }
};

export default { registerUser, loginUser, getUserProfile, logoutUser, getUserHistory, addToHistory };

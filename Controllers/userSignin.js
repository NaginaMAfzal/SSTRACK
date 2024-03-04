/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
import bcryptjs from 'bcryptjs';
import status from 'http-status';
import jwt from 'jsonwebtoken';
import moment from 'moment-timezone';
import Model from '../Models/Model';

const createToken = (user, res, next) => {
    const { id, email, name, userType, company, timezone, timezoneOffset } = user;
    const payload = {
        _id: id,
        timezone, // Add the timezone property to the payload
        email,
        name,
        userType,
        company,
        timezoneOffset
    };

    // create a token
    jwt.sign(
        payload,
        process.env.JwtSecret, {
        expiresIn: '365d',
    },
        (err, token) => {
            // Error Create the Token
            if (err) {
                res.status(500);
                next(new Error('Unable to generate Token.'));
            } else {
                // Token Created
                res.json({
                    token, user
                });
            }
        }
    );
};

const normalizeEmail = (email) => {
    // Normalize email address by removing dots from local part
    const [localPart, domain] = email.split('@');
    const normalizedLocalPart = localPart.replace(/\./g, '');
    return `${normalizedLocalPart}@${domain}`;
};

const userSignIn = (req, res, next) => {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Find user with the passed email
    Model.UserModel.findOne({ email: normalizedEmail }).then(user => {
        if (user) {
            if (!user.isArchived) {
                // if email found compare the password
                bcryptjs.compare(password, user.password).then(result => {
                    // if password match create payload
                    if (result) {
                        createToken(user, res, next);
                    } else {
                        res.status(400);
                        next(new Error('Invalid Password'));
                    }
                });
            }
            else {
                res.status(400);
                next(new Error('Something went wrong With This Email'));
            }

        } else {
            // Wrong Password.
            res.status(400);
            next(new Error('No User Exist With This Email'));
        }
    });
};

const onlineStatus = async (req, res) => {
    const userId = req.user._id;

    try {
        // Check if the user exists
        const user = await Model.UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the user has been inactive for more than 5 minutes
        const lastActiveTime = user.lastActive.getTime();
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - lastActiveTime;
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
        const isActive = user.isActive;

        // Update the user's status
        user.isActive = isActive;
        await user.save();

        return res.status(200).json({ success: true, data: { isActive } });
    } catch (error) {
        console.error('Error updating user status:', error);
        return res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
};

const getUserActiveStatus = async (req, res) => {
    const userId = req.user._id;

    try {
        // Check if the user exists
        const user = await Model.UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the user has been inactive for more than 5 minutes
        const lastActiveTime = user.lastActive.getTime();
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - lastActiveTime;
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
        const isActive = user.isActive;



        return res.status(200).json({ success: true, data: { isActive } });
    } catch (error) {
        console.error('Error getting user active status:', error);
        return res.status(500).json({ success: false, message: 'Failed to get user active status' });
    }
};

const updateLastActiveTime = async (req, res) => {
    const userId = req.params.id;

    try {
        // Check if the user exists
        const user = await Model.UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update the user's lastActive time
        user.lastActive = new Date();
        await user.save();

        return res.status(200).json({ success: true, message: 'Last active time updated' });
    } catch (error) {
        console.error('Error updating last active time:', error);
        return res.status(500).json({ success: false, message: 'Failed to update last active time' });
    }
};

const updateSetting = async (req, res, next) => {
    const userId = req.user._id;
    const updateFields = req.body;

    try {
        // Find the user by id
        const user = await Model.UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the password field is being updated
        // if (updateFields.password) {
        //     // Encrypt the new password
        //     const hashedPassword = await bcryptjs.hash(updateFields.password, 12);
        //     user.password = hashedPassword;
        // }

        // Update the user's fields
        Object.keys(updateFields).forEach(async (key) => {
            if (key === 'timezone') {
                // Assign the updated timezone value
                user.timezone = updateFields.timezone;
                user.createdAt = moment(user.createdAt).tz(user.timezone);
                user.updatedAt = moment(user.updatedAt).tz(user.timezone);
            } 
            if (key ==='password') {
                // Encrypt the new password
                const hashedPassword = await bcryptjs.hash(updateFields.password, 12);
                user.password = hashedPassword;
            }
            else {
                // Update the field with the new value
                user[key] = updateFields[key];
            }
        });

        // Save the updated user
        
        const updatedUser = await user.save();
        console.log(updatedUser);
        createToken(updatedUser, res, next);

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error, message: 'Failed to update user' });
    }
};
 
const verifyPassword = async (req, res, next) => {
    const userId = req.user._id;
    const oldPassword = req.body.oldPassword;

    try {
        // Find the user by id
        const user = await Model.UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the password field is being updated
        if (oldPassword) {
            bcryptjs.compare(oldPassword, user.password).then(result => {
                // if password match create payload
                if (result) {
                    return res.status(200).json({ success: true, message: "Password Verified"})
                } else {
                    return res.status(400).json({ success: false, message: 'Invalid Password' });
                }
            });
        }
    } catch (error) {
        console.error('Wrong Password:', error);
        res.status(500).json({ success: false, error: error, message: 'Something went wrong' });
    }
}

const updatePassword = async (req, res) => {
    const { password } = req.body;
    try {
        const findUser = await Model.UserModel.findById(req.params.id)
        if (!findUser) {
            return res.status(404).json({ success: false, message: 'Invalid user id' });
        }
        if (password === "") {
            return res.status(404).json({ success: false, message: 'Password is required' });
        }
        const hashedPassword = await bcryptjs.hash(password, 12);
        findUser.password = hashedPassword
        const updatedUser = await findUser.save()
        return res.status(200).json({ success: true, message: "Password update successfully", user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

const deleteUser = (req, res) => {
    const { id } = req.params;
    Model.UserModel.findByIdAndRemove(id, (err, result) => {
        if (result) {
            res.status(status.OK).send({
                Message: 'User Deleted Successfully.',
            });
        } else {
            res.status(status.INTERNAL_SERVER_ERROR).send({
                Message: 'Unable to Delete.',
                err,
            });
        }
    });
};

export default {
    userSignIn,
    onlineStatus,
    updateLastActiveTime,
    updateSetting,
    deleteUser,
    getUserActiveStatus,
    updatePassword,
    verifyPassword
};
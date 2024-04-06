import express from 'express';
import userSignIn from '../Controllers/userSignin';
import adminSignIn from '../Controllers/adminSignin';
import isLoggedIn from '../Middlewares/loggedIn';
import userValidator from '../validations/user';

import superAdminSignIn from '../Controllers/ownerSignIn';

const signInRouter = express.Router();

signInRouter.post('/', userValidator.userSignin, userSignIn.userSignIn);

signInRouter.patch('/userStatus', isLoggedIn.isLoggedIn, userSignIn.onlineStatus);

signInRouter.delete('/userDelete/:id', isLoggedIn.isLoggedIn, userSignIn.deleteUser);

signInRouter.patch('/users/Verifypass', isLoggedIn.isLoggedIn, userSignIn.verifyPassword);

signInRouter.patch('/users/:id/last-active', isLoggedIn.isLoggedIn, userSignIn.updateLastActiveTime);

signInRouter.patch('/users/Update', isLoggedIn.isLoggedIn, userSignIn.updateSetting);

signInRouter.patch('/users/update-password/:id', userSignIn.updatePassword);

signInRouter.post('/admin', adminSignIn);

signInRouter.post('/ownerSignIn', superAdminSignIn);

signInRouter.get('/userStatus-active', isLoggedIn.isLoggedIn, userSignIn.getUserActiveStatus);

export default signInRouter;
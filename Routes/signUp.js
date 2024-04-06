import express from 'express';
import multer from 'multer';
import userSignUp from '../Controllers/userSignup';
import ownerSignUp from '../Controllers/ownerSignUp';
import userValidator from '../validations/user';

const storage = multer.memoryStorage();
const upload = multer({
    storage,
});
const signUpRouter = express.Router();

signUpRouter.post(
    '/',
    upload.single('imageUrl'),
    userValidator.userSignup,
    userSignUp,
);

signUpRouter.post(
    '/ownerSignUp',
    ownerSignUp,
);

export default signUpRouter;
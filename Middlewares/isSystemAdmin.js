const isSystemOwner = (req, res, next) => {
    if (!req.user) {
        res.status(400).send({
            Message: 'System admin not logged In.',
        });
    } else if (req.user.userType == 'system Admin') {
        console.log(req.user.userType);
        return next();
    } else {
        console.log(req.user.userType);
        res.status(400).send({
            Message: 'This operation has restricted access.',
        });
    }
};

module.exports = {
    isSystemOwner,
};
/* eslint-disable func-names */
/* eslint-disable no-undef */
import AWS from 'aws-sdk';
import config from '../config/config';

const UploadToAws = file => {
    // console.log(config);
    const s3bucket = new AWS.S3({
        accessKeyId: config.AWS_ACCESS_KEY,
        secretAccessKey: config.MY_AWS_SECRET_ACCESS_KEY,
        Bucket: config.AWS_BUCKET,
        region: config.MY_AWS_REGION
    });

    return new Promise(function(resolve, reject) {
        s3bucket.createBucket(function() {
            let bodyContent;
            if (file.buffer instanceof Buffer) {
                // If file.buffer is already a Buffer, use it directly
                bodyContent = file.buffer;
            } else {
                // If file.buffer is an ArrayBuffer or an ArrayBufferView, convert to Buffer
                bodyContent = Buffer.from(file.buffer);
            }
            const params = {
                Bucket: config.AWS_BUCKET,
                Key: file.originalname,
                Body: bodyContent,
                // Body: Buffer.from(file.buffer),
                accessKeyId: config.AWS_ACCESS_KEY,
                secretAccessKey: config.MY_AWS_SECRET_ACCESS_KEY,
                region: config.MY_AWS_REGION,
                ACL: 'public-read',
            };
            // console.log(params);
            s3bucket.upload(params, function(err, data) {
                if (err) {
                    // eslint-disable-next-line prefer-promise-reject-errors
                    reject(`Could'nt upload Files!!!!! ${err}`);
                    console.log(err);
                } else {
                    resolve(data.Location);
                }
            });
        });
    });
};

const UploadUpdationToAws = file => {
    // console.log(config);
    const s3bucket = new AWS.S3({
        accessKeyId: config.AWS_ACCESS_KEY2,
        secretAccessKey: config.MY_AWS_SECRET_ACCESS_KEY2,
        Bucket: config.AWS_BUCKET2,
        region: config.MY_AWS_REGION2
    });

    return new Promise(function(resolve, reject) {
        s3bucket.createBucket(function() {
            const params = {
                Bucket: config.AWS_BUCKET2,
                Key: file.originalname,
                Body: file.buffer,
                accessKeyId: config.AWS_ACCESS_KEY2,
                secretAccessKey: config.MY_AWS_SECRET_ACCESS_KEY2,
                region: config.MY_AWS_REGION2,
                ACL: 'public-read',
            };
            // console.log(params);
            s3bucket.upload(params, function(err, data) {
                if (err) {
                    // eslint-disable-next-line prefer-promise-reject-errors
                    reject(`Could'nt upload Files!!!!! ${err}`);
                    console.log(err);
                } else {
                    resolve(data.Location);
                }
            });
        });
    });
};

export default { UploadToAws, UploadUpdationToAws };
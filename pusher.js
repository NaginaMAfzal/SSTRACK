import Pusher from "pusher";

const pusher = new Pusher({
    appId: "1689786",
    key: "334425b3c859ed2f1d2b",
    secret: "4f194ad6603392f77f20",
    cluster: "ap2",
    useTLS: true
  });

  export default { pusher };
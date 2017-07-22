const nodemailer = require('nodemailer');
const helper = require('./helper');

let sendFeedback = (feedback) =>{
  return new Promise((resolve, reject)=>{
    console.log('############', feedback);
    let message = feedback.split('_');

    if(message.length===2){
      if(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(message[0]) && message[1].trim()!==""){
        let transporter = nodemailer.createTransport({
           service: 'gmail',
           auth: {
               user: 'xploria.info@gmail.com',
               pass: 'Password1$'
           }
        });

        let mailOptions = {
            from: '"Xploria Bot 👻" <xploria.info@gmail.com>', // sender address
            to: 'km.aguswira@gmail.com', // list of receivers
            subject: `Xploria Bot Feedback from ${message[0]}`, // Subject line
            text: `${message[1].trim()}`, // plain text body
            html: `<b>${message[1].trim()}</b>` // html body
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              helper.errorHandler(error, 'nodemailer cannot send email', feedback);
              resolve([helper.buildText("Yahh emailnya ngga ke kirim kak :'(\nCoba beberapa saat lagi yaa ;)")]);
            }
            resolve([helper.buildText('Email terkirim, Terimakasih telah mengirim kritik dan saran kepada kami :)')]);
        });
      }else{
        resolve([helper.buildText('Kayaknya ada yang salah deh :p\nCoba cek lagi emailnya valid apa ngga, sama pesan kesannya apa :)')]);
      }
    }else{
      resolve([helper.buildText('Kayaknya ada yang salah deh :p\nCoba cek lagi format nulisnya udah bener belom :)')]);
    }
  });
};

module.exports={
  sendFeedback:sendFeedback
};

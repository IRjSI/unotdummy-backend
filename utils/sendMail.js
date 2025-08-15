import nodemailer from "nodemailer";

const sendEmail = async (to, subject, htmlContent) => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST,
    port: process.env.MAILTRAP_PORT,
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS
    }
  });

  const res = await transporter.sendMail({
    from: `"UNotDummy" <${process.env.MAILTRAP_FROM}>`,
    to,
    subject,
    html: htmlContent,
  });
  console.log(res)
};

export default sendEmail;
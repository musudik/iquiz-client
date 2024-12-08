// src/components/QRCodeGenerator.js
import React from 'react';
import QRCode from 'qrcode.react';

function QRCodeGenerator({ quizId }) {
  return (
    <div>
      <QRCode value={`https://yourapp.com/quiz/${quizId}`} />
    </div>
  );
}

export default QRCodeGenerator;
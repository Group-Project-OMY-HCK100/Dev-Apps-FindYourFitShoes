function publicUser(user) {
  return { id: user.id, name: user.name };
}

function selfUser(user) {
  return { ...publicUser(user), email: user.email, createdAt: user.createdAt };
}

function shoeSummary(shoe) {
  return {
    id: shoe.id,
    seller: publicUser(shoe.seller),
    imgUrl1: shoe.imgUrl1,
    brand: shoe.brand,
    article: shoe.article,
    category: shoe.category,
    condition: shoe.condition,
    size: Number(shoe.size),
    color: shoe.color,
    price: shoe.price,
    currency: 'IDR',
    status: shoe.status,
    createdAt: shoe.createdAt,
    updatedAt: shoe.updatedAt,
  };
}

function shoeDetail(shoe) {
  return {
    ...shoeSummary(shoe),
    imgUrl2: shoe.imgUrl2 || null,
    imgUrl3: shoe.imgUrl3 || null,
    imgUrl4: shoe.imgUrl4 || null,
    imgUrl5: shoe.imgUrl5 || null,
    description: shoe.description,
  };
}

function message(messageModel) {
  return {
    id: messageModel.id,
    chatId: messageModel.chatId,
    senderId: messageModel.senderId,
    clientMessageId: messageModel.clientMessageId,
    text: messageModel.text,
    readAt: messageModel.readAt || null,
    createdAt: messageModel.createdAt,
  };
}

module.exports = { publicUser, selfUser, shoeSummary, shoeDetail, message };

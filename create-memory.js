const createMemory = (sizeInBytes) => {
  const ab = new ArrayBuffer(sizeInBytes); //raw buffer of binary data
  const dv = new DataView(ab); //abstract layer which lets us manipulate the buffer
  return dv;
};

module.exports = createMemory;

const createMemory = require("./create-memory");
const instructions = require("./instruction.js");

class CPU {
  constructor(memory) {
    this.memory = memory; //instruction memory

    this.registerNames = [
      "ip", //instruction pointer
      "acc",
      "r1",
      "r2",
      "r3",
      "r4",
      "r5",
      "r6",
      "r7",
      "r8",
      "sp", //stack pointer
      "fp", //frame pointer
    ];

    this.registers = createMemory(this.registerNames.length * 2); //2byte(16 bit) register

    this.registerMap = this.registerNames.reduce((map, name, i) => {
      map[name] = i * 2; //byte offset on the registers ArrayBuffer
      return map;
    }, {});

    this.setRegister("sp", this.memory.byteLength - 1 - 1);
    this.setRegister("fp", this.memory.byteLength - 1 - 1);

    this.stackFrameSize = 0;
  }

  debug() {
    this.registerNames.forEach((name) => {
      console.log(
        `${name}: 0x${this.getRegister(name).toString(16).padStart(4, "0")}`
      );
    });
    console.log();
  }

  viewMemoryAt(address, n) {
    const nextNBytes = Array.from({ length: n }, (_, i) => {
      return this.memory.getUint8(address + i);
    }).map((val) => `0x${val.toString(16).padStart(2, "0")}`);

    console.log(
      `0x${address.toString(16).padStart(4, "0")}: ${nextNBytes.join(" ")}`
    );
  }

  getRegister(name) {
    if (!(name in this.registerMap)) {
      throw new Error(`getRegister: No such register '${name}'`);
    }
    return this.registers.getUint16(this.registerMap[name]);
  }

  setRegister(name, value) {
    if (!(name in this.registerMap)) {
      throw new Error(`setRegister: No such register '${name}'`);
    }
    return this.registers.setUint16(this.registerMap[name], value);
  }

  fetch() {
    const nextInstructionAddress = this.getRegister("ip");
    const instruction = this.memory.getUint8(nextInstructionAddress);
    this.setRegister("ip", nextInstructionAddress + 1);
    return instruction;
  }

  fetch16() {
    const nextInstructionAddress = this.getRegister("ip");
    const instruction = this.memory.getUint16(nextInstructionAddress);
    this.setRegister("ip", nextInstructionAddress + 2);
    return instruction;
  }

  fetchRegisterIndex() {
    // register address takes 1 byte
    // instruction refers to a register using its index
    // we multiply by 2 because each register takes 2 bytes of space
    return (this.fetch() % this.registerNames.length) * 2;
  }

  push(value) {
    this.stackFrameSize += 1;
    const stackAddress = this.getRegister("sp");
    this.memory.setUint16(stackAddress, value);
    this.setRegister("sp", stackAddress - 2);
  }

  pop() {
    this.stackFrameSize -= 1;
    const nextSpAddress = this.getRegister("sp") + 2;
    this.setRegister("sp", nextSpAddress);
    return this.memory.getUint16(nextSpAddress);
  }

  pushState() {
    this.push(this.getRegister("r1"));
    this.push(this.getRegister("r2"));
    this.push(this.getRegister("r3"));
    this.push(this.getRegister("r4"));
    this.push(this.getRegister("r5"));
    this.push(this.getRegister("r6"));
    this.push(this.getRegister("r7"));
    this.push(this.getRegister("r8"));
    this.push(this.getRegister("ip"));
    this.push(this.stackFrameSize + 2); // inlcuding the value of the frame size as part of the st

    this.setRegister("fp", this.getRegister("sp"));
    this.stackFrameSize = 0;
  }

  popState() {
    const framePointerAddress = this.getRegister("fp");
    this.setRegister("sp", framePointerAddress);

    this.stackFrameSize = this.pop();
    const stackFrameSize = this.stackFrameSize;

    this.setRegister("ip", this.pop());
    this.setRegister("r8", this.pop());
    this.setRegister("r7", this.pop());
    this.setRegister("r6", this.pop());
    this.setRegister("r5", this.pop());
    this.setRegister("r4", this.pop());
    this.setRegister("r3", this.pop());
    this.setRegister("r2", this.pop());
    this.setRegister("r1", this.pop());

    const nArgs = this.pop(); // number of arguments passed into call subroutine
    console.log(`args: ${nArgs}`);
    for (let i = 0; i < nArgs; i++) {
      this.pop();
    }

    this.setRegister("fp", framePointerAddress + stackFrameSize);
  }

  execute(instruction) {
    // console.log(`instruction: ${instruction}`);
    switch (instruction) {
      // mov literal(eg 0x1234) r1
      case instructions.MOV_LIT_REG: {
        const value = this.fetch16(); //value take 2 byte space on instruction(memory) buffer
        const regsiter = this.fetchRegisterIndex();
        this.registers.setUint16(regsiter, value);
        return;
      }

      //  mov reg reg
      case instructions.MOV_REG_REG: {
        const registerFrom = this.fetchRegisterIndex();
        const registerTo = this.fetchRegisterIndex();
        const value = this.registers.getUint16(registerFrom);
        this.registers.setUint16(registerTo, value);
        return;
      }

      // mov reg mem (move the value on reg_address to mem_address)
      case instructions.MOV_REG_MEM: {
        const registerFrom = this.fetchRegisterIndex();
        const address = this.fetch16();
        const value = this.registers.getUint16(registerFrom);
        this.memory.setUint16(address, value);
        return;
      }

      // mov mem reg (move the value on mem_address to reg_address)
      case instructions.MOV_MEM_REG: {
        const address = this.fetch16();
        const registerTo = this.fetchRegisterIndex();
        const value = this.memory.getUint16(address);
        this.registers.setUint16(registerTo, value);
        return;
      }

      // add r1(index of the register) r2(index of the register)
      case instructions.ADD_REG_REG: {
        const r1 = this.fetchRegisterIndex(); // register address take 1 byte space on instruction(memory) buffer
        const r2 = this.fetchRegisterIndex(); // for now we are assuming that memory uses register index when refering to a register
        const registerValue1 = this.registers.getUint16(r1);
        const registerValue2 = this.registers.getUint16(r2);
        this.setRegister("acc", registerValue1 + registerValue2);
        return;
      }

      // jne literal address (jump IP to address if literal is not equal to val in accumulator)
      case instructions.JMP_NOT_EQ: {
        const literal = this.fetch16();
        const address = this.fetch();
        if (literal != this.getRegister("acc")) {
          this.setRegister("ip", address);
        }
        return;
      }

      // psh lit (pushes the literal on the stack)
      case instructions.PSH_LIT: {
        const literal = this.fetch16();
        this.push(literal);
        return;
      }

      // psh reg (pushes the value from reg onto the stack)
      case instructions.PSH_REG: {
        const registerIndex = this.fetchRegisterIndex();
        const value = this.registers.getUint16(registerIndex);
        this.push(value);
        return;
      }

      // pop reg (pops the value from the stack into the register)
      case instructions.POP_REG: {
        const registerIndex = this.fetchRegisterIndex();
        const value = this.pop();
        this.registers.setUint16(registerIndex, value);
        return;
      }

      // cal lit (call address of the subroutine is the literal value)
      case instructions.CAL_LIT: {
        const address = this.fetch16();
        this.pushState();
        this.setRegister("ip", address);
        return;
      }

      // cal reg (call address of the subroutine is the registal value)
      case instructions.CAL_REG: {
        const registerIndex = this.fetchRegisterIndex();
        const address = this.registers.getUint16(registerIndex);
        this.pushState();
        this.setRegister("ip", address);
        return;
      }

      // RET (return out of the subroutine)
      case instructions.RET: {
        this.popState();
        return;
      }
    }
  }

  step() {
    const instruction = this.fetch();
    this.execute(instruction);
  }
}

module.exports = CPU;

## Day 1

CPU is capable of executing instructions:
mov(1 byte) literal(2 byte) r1(1 byte) : 0x10 | 0x12 0x34 | : we implicitly assume 0x10 is move to r1  
mov literal r2: 0x11 | 0xab 0xcd | : we implicitly assume 0x11 is mov to r2  
add reg reg: 0x12 | reg1 index | reg2 index

The advantage of implicit operation instruction is that we can reduce the amount of instructions  
needed to be executed on the CPU, which can be useful if the operation is executed many times
The disadvantage is that (based on our example) if we have loads of registers we will have to define
implicit operation instruction for all of them which used more space on the instruction table

## Day 2

Begin by removing the implicit operation instruction
Added more cpu operations:

1. mv lit reg
2. mv reg reg
3. mv reg mem
4. mv mem reg
5. add reg reg
6. jne literal addr (jump IP to addr if literal != ACC)

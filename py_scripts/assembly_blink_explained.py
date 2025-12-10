"""
Assembly Language Explained: The Blink Sketch
==============================================

This educational script demonstrates how a simple blink program works at the
assembly language level on the Raspberry Pi Pico (ARM Cortex-M0+ processor).

We'll explore:
1. High-level Python code for blinking an LED
2. The same logic written in ARM Thumb assembly
3. The machine code (hex and binary) that the processor actually executes

The Pico uses ARM Thumb instructions - a compact 16-bit instruction set.
"""

from machine import Pin
from utime import sleep
import micropython

# =============================================================================
# PART 1: HIGH-LEVEL PYTHON BLINK
# =============================================================================
print("=" * 60)
print("PART 1: HIGH-LEVEL PYTHON BLINK")
print("=" * 60)
print(
    """
In Python/MicroPython, blinking an LED is simple:

    from machine import Pin
    from utime import sleep
    
    pin = Pin("LED", Pin.OUT)
    while True:
        pin.toggle()
        sleep(1)

But what happens at the processor level?
Let's dive deeper...
"""
)
sleep(2)

# =============================================================================
# PART 2: UNDERSTANDING GPIO REGISTERS
# =============================================================================
print("=" * 60)
print("PART 2: UNDERSTANDING GPIO REGISTERS")
print("=" * 60)
print(
    """
The Pico's RP2040 chip controls GPIO pins through memory-mapped registers.

Key concept: Writing a value to a specific memory address controls hardware!

For GPIO25 (the onboard LED on Pico):
- GPIO_OUT register controls the pin state
- Writing '1' turns LED ON
- Writing '0' turns LED OFF

The assembly code directly manipulates these hardware registers.
"""
)
sleep(2)

# =============================================================================
# PART 3: ARM THUMB ASSEMBLY - THE BLINK FUNCTION
# =============================================================================
print("=" * 60)
print("PART 3: ARM THUMB ASSEMBLY - THE BLINK FUNCTION")
print("=" * 60)
print(
    """
Here's the assembly code that makes an LED blink:

@micropython.asm_thumb
def asm_blink(r0):
    # r0 contains the GPIO base address (passed in)
    
    # --- TURN LED ON ---
    mov(r1, 1)          # r1 = 1 (value to turn ON)
    str(r1, [r0, 8])    # Store r1 to [r0+8] (GPIO output register)
    
    # --- DELAY LOOP 1 (LED ON) ---
    mov(r2, 0x4000)     # r2 = 16384 (loop counter)
    label(loop1)
    sub(r2, r2, 1)      # r2 = r2 - 1
    cmp(r2, 0)          # Compare r2 with 0
    bne(loop1)          # If not equal, branch back to loop1
    
    # --- TURN LED OFF ---
    mov(r1, 0)          # r1 = 0 (value to turn OFF)
    str(r1, [r0, 8])    # Store r1 to [r0+8]
    
    # --- DELAY LOOP 2 (LED OFF) ---
    mov(r2, 0x4000)     # r2 = 16384 (loop counter)
    label(loop2)
    sub(r2, r2, 1)      # r2 = r2 - 1
    cmp(r2, 0)          # Compare r2 with 0
    bne(loop2)          # If not equal, branch back to loop2
    
    # --- RETURN ---
    bx(lr)              # Return to caller
"""
)
sleep(2)

# =============================================================================
# PART 4: INSTRUCTION-BY-INSTRUCTION BREAKDOWN
# =============================================================================
print("=" * 60)
print("PART 4: INSTRUCTION-BY-INSTRUCTION BREAKDOWN")
print("=" * 60)

instructions = [
    (
        "1",
        "mov r1, #1",
        "2001",
        "0010000000000001",
        "Load immediate value 1 into register r1",
    ),
    (
        "2",
        "str r1, [r0, #8]",
        "6071",
        "0110000001110001",
        "Store r1 to memory at address [r0+8] (GPIO output)",
    ),
    (
        "3",
        "mov r2, #0x4000",
        "2240",
        "0010001001000000",
        "Load 16384 (0x4000) into r2 as loop counter",
    ),
    (
        "4",
        "sub r2, r2, #1",
        "3A01",
        "0011101000000001",
        "Subtract 1 from r2 (decrement counter)",
    ),
    (
        "5",
        "cmp r2, #0",
        "2A00",
        "0010101000000000",
        "Compare r2 with 0 (sets condition flags)",
    ),
    (
        "6",
        "bne loop1",
        "D1FB",
        "1101000111111011",
        "Branch if Not Equal - jump back if r2 != 0",
    ),
    (
        "7",
        "mov r1, #0",
        "2000",
        "0010000000000000",
        "Load immediate value 0 into register r1",
    ),
    (
        "8",
        "str r1, [r0, #8]",
        "6071",
        "0110000001110001",
        "Store r1 to memory at address [r0+8] (turn OFF)",
    ),
    (
        "9",
        "mov r2, #0x4000",
        "2240",
        "0010001001000000",
        "Load 16384 into r2 for second delay loop",
    ),
    ("10", "sub r2, r2, #1", "3A01", "0011101000000001", "Subtract 1 from r2"),
    ("11", "cmp r2, #0", "2A00", "0010101000000000", "Compare r2 with 0"),
    (
        "12",
        "bne loop2",
        "D1FB",
        "1101000111111011",
        "Branch if Not Equal - jump back if r2 != 0",
    ),
    (
        "13",
        "bx lr",
        "4770",
        "0100011101110000",
        "Branch and eXchange - return from function",
    ),
]

print("\n#   Assembly             Hex    Binary             Description")
print("-" * 90)
for inst in instructions:
    num, asm, hex_val, binary, desc = inst
    print(f"{num:2}  {asm:20} {hex_val}   {binary}   {desc}")
    sleep(0.3)

sleep(2)

# =============================================================================
# PART 5: UNDERSTANDING THE MACHINE CODE
# =============================================================================
print("\n" + "=" * 60)
print("PART 5: UNDERSTANDING THE MACHINE CODE")
print("=" * 60)
print(
    """
Each ARM Thumb instruction is exactly 16 bits (2 bytes).

The instruction format encodes:
- Operation type (ADD, MOV, BRANCH, etc.)
- Registers involved (r0-r7 for most Thumb ops)
- Immediate values or offsets

Example breakdown of 'mov r1, #1' (hex: 2001):
  
  Binary: 0010 0 000 00000001
          ^^^^ ^  ^^^ ^^^^^^^^
           |   |   |      |
           |   |   |      +-- Immediate value (1)
           |   |   +--------- Destination register (r1 = 001)
           |   +------------- Opcode variant
           +----------------- MOV immediate opcode (00100)
"""
)
sleep(2)

# =============================================================================
# PART 6: THE COMPLETE MACHINE CODE
# =============================================================================
print("=" * 60)
print("PART 6: THE COMPLETE MACHINE CODE")
print("=" * 60)

hex_code = "2001 6071 2240 3A01 2A00 D1FB 2000 6071 2240 3A01 2A00 D1FB 4770"
hex_continuous = "2001607122403A012A00D1FB2000607122403A012A00D1FB4770"

print(
    f"""
Complete hex dump (with spaces for readability):
{hex_code}

Continuous hex (as it appears in memory):
{hex_continuous}

Total size: {len(hex_continuous)//2} bytes ({len(hex_continuous)//4} instructions)
"""
)

binary_full = """0010000000000001 0110000001110001 0010001001000000 0011101000000001
0010101000000000 1101000111111011 0010000000000000 0110000001110001
0010001001000000 0011101000000001 0010101000000000 1101000111111011
0100011101110000"""

print("Complete binary dump:")
print(binary_full)
sleep(2)

# =============================================================================
# PART 7: MEMORY LAYOUT
# =============================================================================
print("\n" + "=" * 60)
print("PART 7: MEMORY LAYOUT")
print("=" * 60)
print(
    """
How this code appears in memory (little-endian format):

Address    Bytes       Instruction
---------- ----------- ---------------------
0x0000     01 20       mov r1, #1
0x0002     71 60       str r1, [r0, #8]
0x0004     40 22       mov r2, #0x4000
0x0006     01 3A       sub r2, r2, #1
0x0008     00 2A       cmp r2, #0
0x000A     FB D1       bne loop1 (offset -5)
0x000C     00 20       mov r1, #0
0x000E     71 60       str r1, [r0, #8]
0x0010     40 22       mov r2, #0x4000
0x0012     01 3A       sub r2, r2, #1
0x0014     00 2A       cmp r2, #0
0x0016     FB D1       bne loop2 (offset -5)
0x0018     70 47       bx lr

Note: ARM uses little-endian byte order - LSB comes first!
That's why 0x2001 is stored as bytes 01 20 in memory.
"""
)
sleep(2)

# =============================================================================
# PART 8: KEY CONCEPTS SUMMARY
# =============================================================================
print("=" * 60)
print("PART 8: KEY CONCEPTS SUMMARY")
print("=" * 60)
print(
    """
KEY ASSEMBLY CONCEPTS DEMONSTRATED:

1. REGISTERS (r0-r7): 
   - Fast storage locations inside the CPU
   - r0: holds GPIO base address (input parameter)
   - r1: holds the value to write (0 or 1)
   - r2: loop counter for delay
   - lr: link register (return address)

2. MOV (Move): 
   - Loads an immediate value into a register
   - mov r1, #1 puts the value 1 into r1

3. STR (Store): 
   - Writes a register value to memory
   - str r1, [r0, #8] writes r1 to address (r0 + 8)

4. SUB (Subtract): 
   - Arithmetic operation
   - sub r2, r2, #1 decrements r2 by 1

5. CMP (Compare): 
   - Compares two values and sets CPU flags
   - Used before conditional branches

6. BNE (Branch if Not Equal): 
   - Conditional jump based on comparison result
   - Creates loops by jumping backward

7. BX LR (Branch and Exchange): 
   - Returns from a function
   - lr holds the return address
"""
)
sleep(2)

# =============================================================================
# PART 9: WHY ASSEMBLY MATTERS
# =============================================================================
print("=" * 60)
print("PART 9: WHY ASSEMBLY MATTERS")
print("=" * 60)
print(
    """
WHY LEARN ASSEMBLY?

1. PERFORMANCE: Assembly runs at maximum speed - no interpreter overhead
   - MicroPython: ~1000x slower than assembly for tight loops
   - Critical for real-time applications

2. HARDWARE ACCESS: Direct control over CPU and peripherals
   - No abstraction layers
   - Precise timing control

3. UNDERSTANDING: Know what your code actually does
   - Every high-level statement becomes assembly
   - Better debugging skills

4. EMBEDDED SYSTEMS: Essential for:
   - Bootloaders
   - Interrupt handlers  
   - Performance-critical routines

5. SECURITY: Understanding how exploits work
   - Buffer overflows
   - Return-oriented programming
"""
)
sleep(2)

# =============================================================================
# PART 10: LIVE DEMONSTRATION
# =============================================================================
print("=" * 60)
print("PART 10: LIVE DEMONSTRATION")
print("=" * 60)
print(
    """
Now let's see both versions in action!

First: Python blink (3 cycles)
Then: A visualization of what the assembly does
"""
)
sleep(2)

# Python blink demonstration
led = Pin("LED", Pin.OUT)
print("\n--- Python Blink (High-Level) ---")
for i in range(3):
    led.on()
    print(f"  Cycle {i+1}: LED ON  (pin.on())")
    sleep(0.5)
    led.off()
    print(f"  Cycle {i+1}: LED OFF (pin.off())")
    sleep(0.5)

print("\n--- Assembly Simulation (What the CPU does) ---")
for i in range(3):
    print(f"\n  Cycle {i+1}:")
    print("    mov r1, #1       ; Load 1 into r1")
    print("    str r1, [r0, #8] ; Write to GPIO -> LED ON")
    led.on()
    sleep(0.3)
    print("    [delay loop 1 - counting down 16384 times...]")
    sleep(0.2)
    print("    mov r1, #0       ; Load 0 into r1")
    print("    str r1, [r0, #8] ; Write to GPIO -> LED OFF")
    led.off()
    sleep(0.3)
    print("    [delay loop 2 - counting down 16384 times...]")
    sleep(0.2)

led.off()  # Ensure LED is off at end

print("\n" + "=" * 60)
print("DEMONSTRATION COMPLETE!")
print("=" * 60)
print(
    """
You've learned:
✓ How Python code translates to assembly instructions
✓ ARM Thumb instruction format (16-bit)
✓ Machine code representation (hex and binary)
✓ Memory-mapped I/O for hardware control
✓ Looping with branch instructions
✓ Register usage in ARM architecture

Next steps:
- Try modifying the delay loop counter (0x4000)
- Explore other GPIO operations
- Look at more complex assembly patterns
"""
)

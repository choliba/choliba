export function greet(name: string): string {
  if (name.trim() === '') {
    throw new Error('name must not be empty');
  }
  return `Hello, ${name}!`;
}

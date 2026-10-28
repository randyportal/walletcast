export default function CardNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-10 text-center">
      <div>
        <h1 className="text-xl font-semibold">Tarjeta no encontrada</h1>
        <p className="text-sm text-muted">El enlace puede ser incorrecto o la tarjeta fue eliminada.</p>
      </div>
    </main>
  );
}

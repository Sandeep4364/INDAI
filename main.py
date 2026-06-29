"""Repository entrypoint for the IndAI backend."""

from uvicorn import run


def main() -> None:
    run("backend.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()

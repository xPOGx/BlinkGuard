import json
import queue
import sys
import threading

QUIT_COMMAND = '{"quit": true}'


class NdjsonTransport:
    def __init__(self, input_stream=None, output_stream=None):
        self.input_stream = input_stream or sys.stdin
        self.output_stream = output_stream or sys.stdout
        self.command_queue = queue.Queue()

    def send(self, payload):
        print(json.dumps(payload), file=self.output_stream)
        self.output_stream.flush()

    def send_serialized(self, payload):
        print(payload, file=self.output_stream)
        self.output_stream.flush()

    def start_input_thread(self):
        input_handler = threading.Thread(target=self._read_input, daemon=True)
        input_handler.start()
        return input_handler

    def stop(self):
        """Close-safe no-op so detector finally never AttributeErrors."""
        return None

    def _enqueue_quit(self, reason):
        self.command_queue.put(QUIT_COMMAND)
        self.send({"debug": reason})

    def _read_input(self):
        self.send({"debug": "Input thread started"})
        while True:
            try:
                line = self.input_stream.readline()
                if not line:
                    self._enqueue_quit("stdin EOF, quitting")
                    break
                stripped_line = line.strip()
                if stripped_line:
                    self.command_queue.put(stripped_line)
                    self.send(
                        {"debug": f"Received command: {stripped_line}"}
                    )
            except Exception as error:
                self._enqueue_quit(f"Input thread error: {str(error)}")
                break

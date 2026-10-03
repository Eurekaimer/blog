// Delimiter resolution follows micromark's GFM strikethrough extension:
// resolve parsed inline events, never decoded text or raw Markdown/HTML.
export function remarkHighlight() {
	const data = this.data();
	(data.micromarkExtensions ||= []).push(highlightSyntax());
	(data.fromMarkdownExtensions ||= []).push({
		canContainEols: ["mark"],
		enter: {
			mark(token) {
				this.enter({ type: "mark", children: [], data: { hName: "mark" } }, token);
			},
		},
		exit: {
			mark(token) {
				const node = this.stack[this.stack.length - 1];
				this.exit(token);
				// Character references can decode to whitespace after tokenization.
				if (
					node.children.every(
						(child) => child.type === "text" && /^\s*$/u.test(child.value),
					)
				) {
					node.type = "text";
					node.value = `==${node.children.map((child) => child.value).join("")}==`;
					delete node.children;
					delete node.data;
				}
			},
		},
	});
}

function highlightSyntax() {
	const delimiter = {
		name: "highlight",
		tokenize,
		resolveAll,
	};
	return {
		text: { 61: delimiter },
		insideSpan: { null: [delimiter] },
		attentionMarkers: { null: [61] },
	};

	function tokenize(effects, ok, nok) {
		const previous = this.previous;
		const events = this.events;
		let size = 0;
		return start;

		function start(code) {
			// Do not turn the tail of a longer, unescaped run into a delimiter.
			if (
				previous === 61 &&
				events[events.length - 1]?.[1].type !== "characterEscape"
			) {
				return nok(code);
			}
			effects.enter("markSequenceTemporary");
			return sequence(code);
		}

		function sequence(code) {
			if (code === 61) {
				if (size === 2) return nok(code);
				effects.consume(code);
				size++;
				return sequence;
			}
			if (size !== 2) return nok(code);
			const token = effects.exit("markSequenceTemporary");
			token._open = !isWhitespace(code);
			token._close = !isWhitespace(previous);
			return ok(code);
		}
	}

	function resolveAll(events, context) {
		for (let close = 0; close < events.length; close++) {
			const closer = events[close];
			if (
				closer[0] !== "enter" ||
				closer[1].type !== "markSequenceTemporary" ||
				!closer[1]._close
			) {
				continue;
			}
			for (let open = close - 1; open >= 0; open--) {
				const opener = events[open];
				if (
					opener[0] !== "exit" ||
					opener[1].type !== "markSequenceTemporary" ||
					!opener[1]._open
				) {
					continue;
				}
				opener[1].type = closer[1].type = "markSequence";
				const mark = {
					type: "mark",
					start: { ...opener[1].start },
					end: { ...closer[1].end },
				};
				const text = {
					type: "markText",
					start: { ...opener[1].end },
					end: { ...closer[1].start },
				};
				let children = events.slice(open + 1, close);
				// Resolve emphasis and other inline constructs inside the highlight.
				const resolved = new Set();
				for (const construct of context.parser.constructs.insideSpan.null || []) {
					if (construct.resolveAll && !resolved.has(construct.resolveAll)) {
						resolved.add(construct.resolveAll);
						children = construct.resolveAll(children, context);
					}
				}
				const replacement = [
					["enter", mark, context],
					["enter", opener[1], context],
					["exit", opener[1], context],
					["enter", text, context],
					...children,
					["exit", text, context],
					["enter", closer[1], context],
					["exit", closer[1], context],
					["exit", mark, context],
				];
				events.splice(open - 1, close - open + 3, ...replacement);
				close = open + replacement.length - 2;
				break;
			}
		}
		for (const event of events) {
			if (event[1].type === "markSequenceTemporary") event[1].type = "data";
		}
		return events;
	}
}

function isWhitespace(code) {
	// Micromark uses negative codes for tabs and line endings, null for EOF.
	return code === null || code < 0 || /\s/u.test(String.fromCodePoint(code));
}

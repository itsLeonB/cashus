import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitReminderForm } from "./SplitReminderForm";

test("send form has associated labels, a submit button, no amount and accessible errors", () => {
  const html = renderToStaticMarkup(<SplitReminderForm onSend={async () => { throw { detail: "Already sent" }; }} />);
  expect(html).toContain('for="split-description"');
  expect(html).toContain('id="split-description"');
  expect(html).toContain('for="split-meal-date"');
  expect(html).toContain('type="submit"');
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('name="amount"');
});

import { expect, test } from "@playwright/test";

// A 1x1 grey PNG: enough for the mock, and no dataset image in the repo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==",
  "base64",
);

// The mock's account by default; set these when running against FastAPI.
const USERNAME = process.env.E2E_USERNAME ?? "clinician";
const PASSWORD = process.env.E2E_PASSWORD ?? "demo";

test("sign in, analyse an image, and find it in history", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login\?next=%2Fhistory$/);
  await expect(page.getByRole("note").first()).toContainText("not a medical device");

  await page.getByLabel("Username").fill(USERNAME);
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect username or password" })).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText("You have not analysed any images yet.")).toBeVisible();

  await page.getByRole("link", { name: "Analyse", exact: true }).click();
  await page.getByLabel(/drop a chest x-ray/i).setInputFiles({
    name: "cxr.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  const submit = page.getByRole("button", { name: "Analyse image" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox", { name: /frontal/i }).check();
  await submit.click();

  await expect(page.getByText("Decision support only")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Review suggested for|No finding detected/ }),
  ).toBeVisible();
  await page.getByText("Audit details").click();
  const fingerprint = (await page.locator("dd .font-mono").nth(1).textContent())!.trim();
  expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByTitle(fingerprint)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/analyse");
  await expect(page).toHaveURL(/\/login\?next=%2Fanalyse$/);
});

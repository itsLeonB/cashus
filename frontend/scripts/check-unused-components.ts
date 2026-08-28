// scripts/check-unused-components.ts
import fs from "node:fs";
import path from "node:path";

if (!fs.existsSync("tmp")) {
  fs.mkdirSync("tmp", { recursive: true });
}

const projectRoot = process.cwd();

// Directories to check for components
const directoriesToCheck = [
  "src/components/ui",
  "src/components",
  "src/contexts",
  "src/layouts",
  "src/pages",
  "src/pages/auth",
]
  .toSorted()
  .filter((dir) => fs.existsSync(path.join(projectRoot, dir)));

const srcDir = path.join(projectRoot, "src");

interface Component {
  name: string;
  displayName: string; // How it might appear in JSX (could be different from filename)
  ext: string;
  dir: string;
  fullPath: string;
}

console.log("🔍 Checking unused components in:");
directoriesToCheck.forEach((dir) => console.log(`  📁 ${dir}`));
console.log("");

// Get all components from specified directories
const allComponents: Component[] = [];

directoriesToCheck.forEach((directory) => {
  const fullDirPath = path.join(projectRoot, directory);

  if (!fs.existsSync(fullDirPath)) {
    console.log(`⚠️  Directory ${directory} does not exist`);
    return;
  }

  const componentsInDir = fs
    .readdirSync(fullDirPath)
    .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
    .map((file) => {
      const name = path.basename(file, path.extname(file));
      return {
        name,
        displayName: convertFileNameToComponentName(name),
        ext: path.extname(file),
        dir: directory.replace("src/", ""),
        fullPath: path.join(directory, file),
      };
    });

  allComponents.push(...componentsInDir);
});

console.log(`📊 Found ${allComponents.length} components total\n`);

// Search for imports and usage of these components
const usedComponents: Component[] = [];
const unusedComponents: Component[] = [];
const files = getAllFiles(srcDir);

allComponents.forEach((component) => {
  try {
    let isUsed = false;

    for (const file of files) {
      if (
        file.endsWith(".ts") ||
        file.endsWith(".tsx") ||
        file.endsWith(".js") ||
        file.endsWith(".jsx")
      ) {
        // Skip the component file itself
        const normalizedFile = path.normalize(file);
        const normalizedComponentPath = path.normalize(
          path.join(projectRoot, component.fullPath)
        );
        if (normalizedFile === normalizedComponentPath) {
          continue;
        }

        const content = fs.readFileSync(file, "utf8");

        if (checkUsage(component, content)) {
          isUsed = true;
          break;
        }
      }
    }

    if (isUsed) {
      usedComponents.push(component);
      console.log(`✅ ${component.dir}/${component.name} - used`);
    } else {
      unusedComponents.push(component);
      console.log(`❌ ${component.dir}/${component.name} - unused`);
    }
  } catch (error) {
    console.log(`⚠️  ${component.dir}/${component.name} - error: ${error}`);
  }
});

// Sort results
const sortByDir = (a: Component, b: Component) =>
  a.dir.localeCompare(b.dir) || a.name.localeCompare(b.name);

usedComponents.sort(sortByDir);
unusedComponents.sort(sortByDir);

console.log(`\n📊 Summary:`);
console.log(`✅ Used: ${usedComponents.length} components`);
console.log(`❌ Unused: ${unusedComponents.length} components`);
console.log(`📦 Total: ${allComponents.length} components`);

// Generate reports
generateReports(usedComponents, unusedComponents);

function checkUsage(component: Component, content: string): boolean {
  // Check 1: Import statements
  const importPatterns = [
    `from ['"]@/${component.dir}/${component.name}['"]`,
    String.raw`from ['"]\./${component.name}['"]`,
    String.raw`from ['"]\.\./${component.name}['"]`,
    // For contexts
    component.dir === "contexts" ? `${component.name}Context` : null,
    component.dir === "contexts" ? `${component.name}Provider` : null,
  ].filter(Boolean);

  const hasImport = importPatterns.some((pattern) =>
    new RegExp(pattern!, "i").test(content)
  );

  // Check 2: JSX usage (component tags)
  // Look for <ComponentName or <ComponentName.
  const jsxRegex = new RegExp(String.raw`<${component.displayName}[\s>.]`, "g");
  const hasJsxUsage = jsxRegex.test(content);

  // Check 3: Dynamic imports
  const dynamicImportRegex = new RegExp(
    String.raw`import\(['"]\.*[/]?${component.dir}/${component.name}['"]\)`,
    "i"
  );
  const hasDynamicImport = dynamicImportRegex.test(content);

  return hasImport || hasJsxUsage || hasDynamicImport;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    // Skip unwanted directories
    const skipDirs = ["node_modules", "dist", ".git", ".next", ".vscode"];
    const pathSegments = currentDir.split(path.sep);
    if (skipDirs.some((skip) => pathSegments.includes(skip))) {
      return;
    }

    try {
      const items = fs.readdirSync(currentDir);

      items.forEach((item) => {
        const fullPath = path.join(currentDir, item);

        try {
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            traverse(fullPath);
          } else if (stat.isFile()) {
            files.push(fullPath);
          }
        } catch (err) {
          console.warn(`⚠️  Skipping file ${fullPath}: ${err}`);
        }
      });
    } catch (err) {
      console.warn(`⚠️  Skipping directory ${currentDir}: ${err}`);
    }
  }

  traverse(dir);
  return files;
}

function convertFileNameToComponentName(fileName: string): string {
  // Convert kebab-case or snake_case to PascalCase
  return fileName
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function generateReports(used: Component[], unused: Component[]) {
  // Create cleanup script
  let cleanupScript = "#!/bin/bash\n\n";
  cleanupScript += "# Remove unused components\n";
  cleanupScript += "# Generated on: " + new Date().toISOString() + "\n\n";

  if (unused.length > 0) {
    console.log("\n❌ Unused components by directory:");

    const groupedByDir: Record<string, Component[]> = {};
    unused.forEach((comp) => {
      if (!groupedByDir[comp.dir]) groupedByDir[comp.dir] = [];
      groupedByDir[comp.dir].push(comp);
    });

    Object.entries(groupedByDir).forEach(([dir, comps]) => {
      console.log(`\n  📁 ${dir}/`);
      comps.forEach((comp) => console.log(`    - ${comp.name}${comp.ext}`));

      // Add to cleanup script
      cleanupScript += `# ${dir}\n`;
      comps.forEach((comp) => {
        cleanupScript += `rm "${comp.fullPath}"\n`;
      });
      cleanupScript += "\n";
    });

    fs.writeFileSync("tmp/cleanup-unused.sh", cleanupScript);
    console.log("\n🔧 Cleanup script created: tmp/cleanup-unused.sh");
    console.log(
      "   Run: chmod +x tmp/cleanup-unused.sh && ./tmp/cleanup-unused.sh"
    );
  }

  // Save detailed JSON report
  const report = {
    generated: new Date().toISOString(),
    statistics: {
      total: allComponents.length,
      used: used.length,
      unused: unused.length,
      usagePercentage:
        allComponents.length > 0
          ? Math.round((used.length / allComponents.length) * 100)
          : 0,
    },
    directoriesChecked: directoriesToCheck,
    usedComponents: used.map((c) => ({
      name: c.name,
      displayName: c.displayName,
      directory: c.dir,
      path: c.fullPath,
    })),
    unusedComponents: unused.map((c) => ({
      name: c.name,
      displayName: c.displayName,
      directory: c.dir,
      path: c.fullPath,
      size: getFileSize(c.fullPath),
    })),
  };

  fs.writeFileSync(
    "tmp/component-usage-report.json",
    JSON.stringify(report, null, 2)
  );

  console.log("\n📄 Detailed report saved to: tmp/component-usage-report.json");

  // Calculate potential savings
  const totalUnusedSize = unused.reduce((sum, comp) => {
    return sum + (getFileSize(comp.fullPath) || 0);
  }, 0);

  console.log(`\n💾 Potential savings: ${formatFileSize(totalUnusedSize)}`);
}

function getFileSize(filePath: string): number | null {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
}

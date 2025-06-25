import React from "react";

describe("树结构处理逻辑测试", () => {
  // 原始Excel数据（9列）
  const mockOriginalExcelData = [
    {
      权限码: "sys:001",
      权限名称: "系统管理",
      权限类型: "菜单",
      权限id: "1",
      父级权限名称: "",
      父级权限id: "",
      权限路径: "/system",
      是否有子节点: "是",
      站点: "后台",
    },
    {
      权限码: "sys:002",
      权限名称: "用户管理",
      权限类型: "菜单",
      权限id: "2",
      父级权限名称: "系统管理",
      父级权限id: "1",
      权限路径: "/system/users",
      是否有子节点: "否",
      站点: "后台",
    },
    {
      权限码: "sys:003",
      权限名称: "角色管理",
      权限类型: "菜单",
      权限id: "3",
      父级权限名称: "系统管理",
      父级权限id: "1",
      权限路径: "/system/roles",
      是否有子节点: "否",
      站点: "后台",
    },
  ];

  // 导出后的Excel数据（13列）
  const mockExportedExcelData = [
    {
      "权限名称（新）": "系统设置",
      "父级权限id（新）": "",
      "权限码（新）": "",
      操作: "修改",
      权限码: "sys:001",
      权限名称: "系统管理",
      权限类型: "菜单",
      权限id: "1",
      父级权限名称: "",
      父级权限id: "",
      权限路径: "/system",
      是否有子节点: "是",
      站点: "后台",
    },
    {
      "权限名称（新）": "",
      "父级权限id（新）": "4",
      "权限码（新）": "",
      操作: "移动",
      权限码: "sys:002",
      权限名称: "用户管理",
      权限类型: "菜单",
      权限id: "2",
      父级权限名称: "系统管理",
      父级权限id: "1",
      权限路径: "/system/users",
      是否有子节点: "否",
      站点: "后台",
    },
    {
      "权限名称（新）": "",
      "父级权限id（新）": "",
      "权限码（新）": "perm:001",
      操作: "替换",
      权限码: "sys:003",
      权限名称: "角色管理",
      权限类型: "菜单",
      权限id: "3",
      父级权限名称: "系统管理",
      父级权限id: "1",
      权限路径: "/system/roles",
      是否有子节点: "否",
      站点: "后台",
    },
    {
      "权限名称（新）": "",
      "父级权限id（新）": "",
      "权限码（新）": "",
      操作: "删除",
      权限码: "sys:004",
      权限名称: "权限管理",
      权限类型: "菜单",
      权限id: "4",
      父级权限名称: "系统管理",
      父级权限id: "1",
      权限路径: "/system/permissions",
      是否有子节点: "否",
      站点: "后台",
    },
  ];

  test("导入导出功能逻辑测试", () => {
    // 测试树结构处理逻辑
    const buildTree = (data, isExported) => {
      // 检查是否是导出后的Excel（包含四个新增列）
      const hasExportColumns =
        isExported ||
        (data.length > 0 &&
          data[0].hasOwnProperty("权限名称（新）") &&
          data[0].hasOwnProperty("父级权限id（新）") &&
          data[0].hasOwnProperty("权限码（新）") &&
          data[0].hasOwnProperty("操作"));

      // 创建根节点映射
      const map = {};
      const result = [];
      const deletedNodes = [];
      const replacedNodes = [];

      // 首先处理所有节点
      data.forEach((item) => {
        let nodeTitle = item["权限名称"];
        let parentId = item["父级权限id"];
        let code = item["权限码"];

        // 如果是导出后的Excel，优先使用新列的数据
        if (hasExportColumns) {
          if (item["权限名称（新）"]) {
            nodeTitle = item["权限名称（新）"];
          }

          if (item["父级权限id（新）"]) {
            parentId = item["父级权限id（新）"];
          }

          if (item["权限码（新）"]) {
            code = item["权限码（新）"];
          }

          // 特殊处理已删除节点
          if (item["操作"] === "删除") {
            const deletedNode = {
              ...item,
              key: item["权限id"],
              title: nodeTitle,
              operation: "删除",
            };
            deletedNodes.push(deletedNode);
            return; // 跳过后续处理
          }

          // 特殊处理已替换节点
          if (item["操作"] === "替换") {
            const replacedNode = {
              ...item,
              key: item["权限id"],
              title: nodeTitle,
              code: code,
              operation: "替换",
            };
            replacedNodes.push(replacedNode);
            return; // 跳过后续处理
          }
        }

        // 常规节点处理
        const node = {
          ...item,
          key: item["权限id"],
          title: nodeTitle,
          code: code,
          children: [],
        };

        // 设置操作标记
        if (hasExportColumns && item["操作"]) {
          node.operation = item["操作"];
        }

        map[item["权限id"]] = node;

        if (!parentId) {
          result.push(node);
        }
      });

      // 然后构建父子关系
      data.forEach((item) => {
        const parentId =
          hasExportColumns && item["父级权限id（新）"]
            ? item["父级权限id（新）"]
            : item["父级权限id"];

        if (parentId && map[parentId] && map[item["权限id"]]) {
          map[parentId].children.push(map[item["权限id"]]);
        }
      });

      // 添加删除节点到特殊分类
      if (deletedNodes.length > 0) {
        const deletedRoot = {
          key: "deleted-root",
          title: "已删除",
          children: deletedNodes,
        };
        result.push(deletedRoot);
      }

      // 添加替换节点到特殊分类
      if (replacedNodes.length > 0) {
        const replacedRoot = {
          key: "replaced-root",
          title: "已替换",
          children: replacedNodes,
        };
        result.push(replacedRoot);
      }

      return result;
    };

    // 测试原始Excel处理
    const originalTreeData = buildTree(mockOriginalExcelData, false);
    expect(originalTreeData.length).toBe(1); // 只有一个根节点
    expect(originalTreeData[0].children.length).toBe(2); // 有两个子节点

    // 测试导出格式Excel处理
    const exportedTreeData = buildTree(mockExportedExcelData, true);
    expect(exportedTreeData.length).toBe(3); // 一个根节点 + 已删除 + 已替换

    // 检查根节点名称是否使用了新名称
    expect(exportedTreeData[0].title).toBe("系统设置");

    // 检查是否有删除节点分类
    const deletedRoot = exportedTreeData.find(
      (node) => node.key === "deleted-root"
    );
    expect(deletedRoot).toBeDefined();
    expect(deletedRoot.children.length).toBe(1);

    // 检查是否有替换节点分类
    const replacedRoot = exportedTreeData.find(
      (node) => node.key === "replaced-root"
    );
    expect(replacedRoot).toBeDefined();
    expect(replacedRoot.children.length).toBe(1);
  });

  test("测试移动后编辑的处理", () => {
    // 测试移动后编辑的场景
    const nodeData = {
      "权限名称（新）": "用户管理（新）",
      "父级权限id（新）": "4",
      "权限码（新）": "",
      操作: "移动",
      权限码: "sys:002",
      权限名称: "用户管理",
      权限类型: "菜单",
      权限id: "2",
      父级权限名称: "系统管理",
      父级权限id: "1",
      权限路径: "/system/users",
      是否有子节点: "否",
      站点: "后台",
    };

    // 模拟节点编辑函数
    const handleEdit = (node, newTitle) => {
      // 原始实现会覆盖操作标记
      // node.operation = '修改';

      // 修复后的实现会保留现有操作标记
      if (!node.operation) {
        node.operation = "修改";
      }

      node.title = newTitle;
      return node;
    };

    // 测试编辑移动节点
    const node = {
      ...nodeData,
      key: nodeData["权限id"],
      title: nodeData["权限名称"],
      operation: nodeData["操作"],
    };

    const editedNode = handleEdit(node, "用户管理（编辑后）");

    // 验证操作标记没有被覆盖
    expect(editedNode.operation).toBe("移动");
    expect(editedNode.title).toBe("用户管理（编辑后）");
  });
});

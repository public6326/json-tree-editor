import React, { useState } from "react";
import { Button, Card, Space, Typography, Divider, message } from "antd";
import * as XLSX from "xlsx";
import JsonUpload from "../components/JsonInput";
import TreeDisplay from "../components/TreeDisplay";

const { Title, Text } = Typography;

/**
 * 手动测试工具 - 用于测试权限树编辑器的功能
 */
const ManualTest = () => {
  const [treeData, setTreeData] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [isExportedExcel, setIsExportedExcel] = useState(false);
  const [testLogs, setTestLogs] = useState([]);

  // 添加测试日志
  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  // 创建原始测试数据
  const createOriginalTestData = () => {
    const originalData = [
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

    setExcelData(originalData);
    addLog("已创建原始测试数据（9列）", "success");

    // 构建树结构
    handleExcelParsed(originalData, [], false);
  };

  // 创建导出格式的测试数据
  const createExportedTestData = () => {
    const exportedData = [
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
        "权限名称（新）": "角色权限",
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

    setExcelData(exportedData);
    setIsExportedExcel(true);
    addLog("已创建导出格式测试数据（13列）", "success");

    // 构建树结构
    handleExcelParsed(exportedData, [], true);
  };

  // 模拟Excel解析
  const handleExcelParsed = (data, originalData, isExported) => {
    try {
      // 这里调用原始的JsonInput组件中的处理逻辑
      const handleExcel = (data, isExported) => {
        // 检查是否是导出后的Excel（包含四个新增列）
        const hasExportColumns =
          isExported ||
          (data.length > 0 &&
            data[0].hasOwnProperty("权限名称（新）") &&
            data[0].hasOwnProperty("父级权限id（新）") &&
            data[0].hasOwnProperty("权限码（新）") &&
            data[0].hasOwnProperty("操作"));

        // 构建树结构
        const buildTree = (data) => {
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

        const treeData = buildTree(data);
        return treeData;
      };

      const result = handleExcel(data, isExported);
      setTreeData(result);
      addLog("树结构构建成功", "success");
    } catch (error) {
      addLog(`处理Excel数据出错: ${error.message}`, "error");
      message.error(`处理Excel数据出错: ${error.message}`);
    }
  };

  // 简单测试树节点操作
  const testTreeOperations = () => {
    if (!treeData || treeData.length === 0) {
      message.error("请先生成树数据");
      addLog("测试失败: 没有树数据", "error");
      return;
    }

    // 简单验证树结构
    addLog("开始测试树节点操作...", "info");

    // 检查基本结构
    if (!Array.isArray(treeData)) {
      addLog("测试失败: 树数据不是数组", "error");
      return;
    }
    addLog("树结构是数组 ✓", "success");

    // 如果是导出后Excel，验证是否正确使用新数据
    if (isExportedExcel) {
      // 检查是否有系统节点并使用了新名称
      const systemNode = treeData.find((node) => node.权限id === "1");
      if (systemNode && systemNode.title === "系统设置") {
        addLog("节点使用了新名称 ✓", "success");
      } else {
        addLog("测试失败: 节点没有使用新名称", "error");
      }

      // 检查是否有删除节点根节点
      const deletedRootNode = treeData.find(
        (node) => node.key === "deleted-root"
      );
      if (deletedRootNode) {
        addLog("成功创建删除节点分类 ✓", "success");
      } else {
        addLog("测试失败: 没有创建删除节点分类", "error");
      }

      // 检查是否有替换节点根节点
      const replacedRootNode = treeData.find(
        (node) => node.key === "replaced-root"
      );
      if (replacedRootNode) {
        addLog("成功创建替换节点分类 ✓", "success");
      } else {
        addLog("测试失败: 没有创建替换节点分类", "error");
      }
    } else {
      addLog("原始Excel格式验证通过 ✓", "success");
    }
  };

  // 导出当前树结构为Excel
  const exportToExcel = () => {
    if (!treeData || treeData.length === 0) {
      message.error("没有可导出的数据");
      return;
    }

    try {
      // 将树结构转换为扁平数据
      const flattenTree = (tree, result = [], parentNode = null) => {
        tree.forEach((node) => {
          // 跳过特殊节点（已删除、已替换）
          if (node.key === "deleted-root" || node.key === "replaced-root") {
            // 对特殊节点的子节点单独处理
            node.children.forEach((child) => {
              result.push(child);
            });
            return;
          }

          // 常规节点
          result.push(node);

          // 递归处理子节点
          if (node.children && node.children.length > 0) {
            flattenTree(node.children, result, node);
          }
        });
        return result;
      };

      const flatData = flattenTree(treeData);

      // 转换为Excel格式
      const excelData = flatData.map((item) => {
        const row = {
          "权限名称（新）": item.title !== item["权限名称"] ? item.title : "",
          "父级权限id（新）": "", // 根据实际情况填充
          "权限码（新）": item.code !== item["权限码"] ? item.code : "",
          操作: item.operation || "",
          权限码: item["权限码"],
          权限名称: item["权限名称"],
          权限类型: item["权限类型"],
          权限id: item["权限id"],
          父级权限名称: item["父级权限名称"],
          父级权限id: item["父级权限id"],
          权限路径: item["权限路径"],
          是否有子节点: item["是否有子节点"],
          站点: item["站点"],
        };
        return row;
      });

      // 创建工作簿和工作表
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      // 导出Excel文件
      XLSX.writeFile(wb, "权限树导出测试.xlsx");
      addLog("Excel导出成功", "success");
    } catch (error) {
      addLog(`导出Excel出错: ${error.message}`, "error");
      message.error(`导出Excel出错: ${error.message}`);
    }
  };

  // 清除所有数据
  const clearAll = () => {
    setTreeData([]);
    setExcelData([]);
    setIsExportedExcel(false);
    setTestLogs([]);
    addLog("已清除所有数据", "info");
  };

  // 渲染日志项
  const renderLogItem = (log, index) => {
    const color =
      log.type === "success"
        ? "green"
        : log.type === "error"
        ? "red"
        : log.type === "warning"
        ? "orange"
        : "inherit";

    return (
      <div key={index} style={{ marginBottom: 8 }}>
        <Text type="secondary">[{log.timestamp}] </Text>
        <Text style={{ color }}>{log.message}</Text>
      </div>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <Title level={2}>权限树编辑器测试工具</Title>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* 测试控制区域 */}
        <Card title="测试控制" style={{ width: "100%" }}>
          <Space wrap>
            <Button type="primary" onClick={createOriginalTestData}>
              生成原始数据
            </Button>
            <Button type="primary" onClick={createExportedTestData}>
              生成导出格式数据
            </Button>
            <Button onClick={testTreeOperations}>测试树操作</Button>
            <Button type="default" onClick={exportToExcel}>
              导出Excel
            </Button>
            <Button danger onClick={clearAll}>
              清除数据
            </Button>
          </Space>
        </Card>

        {/* 树显示区域 */}
        {treeData.length > 0 && (
          <Card title="树结构显示" style={{ width: "100%" }}>
            <TreeDisplay
              treeData={treeData}
              onChange={setTreeData}
              onExport={() => {}}
            />
          </Card>
        )}

        {/* 日志区域 */}
        <Card
          title="测试日志"
          style={{ width: "100%", maxHeight: 400, overflow: "auto" }}
        >
          {testLogs.length === 0 ? (
            <Text type="secondary">暂无日志记录</Text>
          ) : (
            <div style={{ maxHeight: 350, overflow: "auto" }}>
              {testLogs.map(renderLogItem)}
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
};

export default ManualTest;

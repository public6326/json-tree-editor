import React, { useState, useRef } from "react";
import { Layout, Row, Col, message, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import JsonUpload from "./components/JsonInput";
import TreeDisplay from "./components/TreeDisplay";
import * as XLSX from "xlsx";
import "./App.css";

const { Content } = Layout;

function App() {
  const [treeData, setTreeData] = useState(null);
  const [jsonString, setJsonString] = useState("");
  const [flatData, setFlatData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [deletedKeys, setDeletedKeys] = useState([]);
  const replacedNodesRef = useRef([]);

  const handleJsonSubmit = (jsonData) => {
    setTreeData(jsonData);
    setJsonString(JSON.stringify(jsonData, null, 2));
  };

  const handleExcelParsed = (data, cols) => {
    if (!flatData.length) {
      const patched = data.map((row) => ({
        ...row,
        _originParentId: row["父级权限id"],
        _originName: row["权限名称"],
      }));
      setFlatData(patched);
    }
    if (!columns.length) {
      setColumns(cols);
    }
  };

  const downloadExcel = () => {
    if (!flatData.length || !columns.length) {
      message.error("没有可导出的数据");
      return;
    }
    const newNameCol = "权限名称（新）";
    const newParentIdCol = "父级权限id（新）";
    const newPermissionCodeCol = "权限码（新）";
    const actionCol = "操作";
    const exportData = flatData.map((row) => {
      const result = {};
      result[newNameCol] = row._newName || "";
      result[newParentIdCol] = row._newParentId || "";
      result[newPermissionCodeCol] = row._newPermissionCode || "";

      let operation = row._action || "";
      if (operation.includes("替换") && operation.includes("移动")) {
        operation = "替换";
      }
      result[actionCol] = operation;

      columns.forEach((col) => {
        result[col] = row[col];
      });
      return result;
    });
    const exportColumns = [
      newNameCol,
      newParentIdCol,
      newPermissionCodeCol,
      actionCol,
      ...columns,
    ];
    const ws = XLSX.utils.json_to_sheet(exportData, { header: exportColumns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "tree-data.xlsx");
    message.success("Excel已下载");
  };

  const handleTreeChange = (newData, deletedNodes = [], replacedNodes = []) => {
    setTreeData(newData);
    setJsonString(JSON.stringify(newData, null, 2));

    console.log("handleTreeChange 开始处理");
    console.log("收到的 replacedNodes:", replacedNodes);
    console.log("收到的 deletedNodes:", deletedNodes);
    console.log("收到的 newData:", newData);

    // 0. 检查是否有新增节点（使用Set去重）
    const addedNodesSet = new Set(); // 使用Set存储节点的唯一标识符
    const addedNodes = [];

    const checkForAddedNodes = (nodes) => {
      if (!nodes || !Array.isArray(nodes)) return;
      nodes.forEach((node) => {
        // 使用节点的key或权限id作为唯一标识
        const nodeId = String(node.权限id || node.key || "");

        // 只有当节点是新增且未被添加过时才加入
        if (node.操作 === "新增" && !addedNodesSet.has(nodeId) && nodeId) {
          console.log("发现新增节点:", node);
          addedNodesSet.add(nodeId);
          addedNodes.push(node);
        }

        // 递归检查子节点
        if (node.children && Array.isArray(node.children)) {
          checkForAddedNodes(node.children);
        }
      });
    };

    checkForAddedNodes(newData);
    console.log(
      "找到新增节点数量:",
      addedNodes.length,
      "唯一标识符数量:",
      addedNodesSet.size
    );

    // 详细输出收集到的新增节点，便于调试
    if (addedNodes.length > 0) {
      console.log("新增节点列表:");
      addedNodes.forEach((node, index) => {
        console.log(
          `[${index}] ID: ${node.权限id || node.key}, 名称: ${
            node.权限名称 || node.title
          }`
        );
      });
    }

    // 1. 处理删除节点
    const deletedKeySet = new Set();
    // 存储被删除节点的权限id，用于标记其所有子节点
    const deletedPermissionIds = new Set();
    // 存储被删除节点的权限码，用于更精确匹配
    const deletedPermissionCodes = new Set();

    // 递归收集所有被删除节点及其子节点的 key
    const addDeletedKeys = (node) => {
      if (!node || !node.key) return;
      deletedKeySet.add(String(node.key));

      // 添加权限id到集合中
      if (node["权限id"]) {
        deletedPermissionIds.add(String(node["权限id"]));
      }

      // 添加权限码到集合中
      if (node["权限码"]) {
        deletedPermissionCodes.add(String(node["权限码"]));
      }

      // 标记当前节点为删除操作
      if (node["操作"] === undefined) {
        node["操作"] = "删除";
      }

      if (node.children && node.children.length) {
        node.children.forEach(addDeletedKeys);
      }
    };

    // 处理所有删除节点
    deletedNodes.forEach((item) => {
      if (item.node) {
        // 确保节点被标记为删除
        if (item.node["操作"] === undefined) {
          item.node["操作"] = "删除";
        }
        addDeletedKeys(item.node);
      }
    });

    setDeletedKeys(Array.from(deletedKeySet));
    console.log("删除节点keys:", Array.from(deletedKeySet));
    console.log("删除节点权限ids:", Array.from(deletedPermissionIds));
    console.log("删除节点权限码:", Array.from(deletedPermissionCodes));

    // 2. 处理替换节点
    // 全局累积所有替换节点
    const allReplacedNodes = [...replacedNodesRef.current];

    // 添加新的替换节点（去重）
    if (replacedNodes && replacedNodes.length) {
      const existingKeys = new Set(
        allReplacedNodes.map((item) => item.node?.key).filter(Boolean)
      );

      replacedNodes.forEach((item) => {
        if (item.node && item.node.key && !existingKeys.has(item.node.key)) {
          allReplacedNodes.push(item);
          existingKeys.add(item.node.key);
        }
      });

      // 更新引用
      replacedNodesRef.current = allReplacedNodes;
    }

    console.log(
      "累积的替换节点:",
      allReplacedNodes.map((item) => item.node?.key)
    );

    // 3. 构建替换信息映射
    const replacedInfo = {};
    // 创建一个从key到父级权限码的映射
    const keyToParentPermissionCode = {};

    allReplacedNodes.forEach((item) => {
      if (item.node && item.node.key) {
        const key = String(item.node.key);
        // 存储父级权限码信息
        if (item.parentPermissionCode) {
          keyToParentPermissionCode[key] = item.parentPermissionCode;
        }

        // 记录替换信息，但不修改原始权限id
        replacedInfo[key] = {
          originalPermissionId: item.originalPermissionId,
          originalPermissionCode: item.originalPermissionCode,
          parentPermissionCode: item.parentPermissionCode,
        };
      }
    });

    console.log("替换信息 keys:", Object.keys(replacedInfo));
    console.log("父级权限码映射:", keyToParentPermissionCode);

    // 4. 更新 flatData
    if (flatData.length && columns.length) {
      const idKey = "权限id";
      const codeKey = "权限码";

      const newFlat = flatData.map((row) => {
        const result = { ...row };
        const key = String(result[idKey]);
        const code = String(result[codeKey]);

        // 重置操作字段
        result._newName = "";
        result._newParentId = "";
        result._newPermissionCode = "";
        result._action = "";

        // 处理删除的节点
        if (
          deletedKeySet.has(key) ||
          (result["父级权限id"] &&
            deletedPermissionIds.has(String(result["父级权限id"]))) ||
          (result["权限码"] &&
            deletedPermissionCodes.has(String(result["权限码"])))
        ) {
          result._action = "删除";
        }
        // 处理替换的节点 - 查找是否有对应的替换信息
        else if (replacedInfo[key]) {
          result._action = "替换";
          // 不修改原始权限id
          // 添加父级权限码到"权限码（新）"列
          if (keyToParentPermissionCode[key]) {
            result._newPermissionCode = keyToParentPermissionCode[key];
          }
        }
        // 处理其他操作（移动和修改）
        else {
          // 查找当前节点是否在树中
          const findNodeInTree = (nodes, targetId) => {
            if (!nodes || !nodes.length) return null;
            for (const node of nodes) {
              if (String(node["权限id"]) === targetId) {
                return node;
              }
              if (node.children) {
                const found = findNodeInTree(node.children, targetId);
                if (found) return found;
              }
            }
            return null;
          };

          const node = findNodeInTree(newData, key);

          // 如果找到节点并且有操作标记
          if (node && node["操作"]) {
            console.log(`发现节点操作: ${key}, 操作: ${node["操作"]}`);
            result._action = node["操作"];

            // 如果是修改操作，记录原始标题
            if (node["操作"] === "修改" && node["原始标题"]) {
              result._newName = node.title;
              console.log(`节点 ${key} 标题被修改为: ${node.title}`);
            }

            // 如果是移动操作，记录新父级ID
            if (node["操作"] === "移动" && node["父级权限id"]) {
              result._newParentId = node["父级权限id"];
              console.log(`节点 ${key} 被移动到新父级: ${node["父级权限id"]}`);
            }
          }
        }

        return result;
      });

      // 5. 处理新增节点 - 添加到flatData中
      if (addedNodes.length > 0) {
        console.log("开始处理新增节点，添加到flatData");

        // 检查现有的flatData，避免重复添加相同ID的节点
        const existingIds = new Set(
          newFlat.map((row) => String(row["权限id"] || ""))
        );
        console.log("现有flatData中的ID数量:", existingIds.size);

        let addedCount = 0;

        addedNodes.forEach((node) => {
          // 获取节点ID并确保是字符串
          const nodeId = String(node.权限id || node.key || "");

          // 跳过已存在的ID
          if (existingIds.has(nodeId)) {
            console.log(`节点ID ${nodeId} 已存在于flatData中，跳过添加`);
            return; // 跳过当前节点
          }

          const newRow = {};

          // 复制列结构
          columns.forEach((col) => {
            newRow[col] = "";
          });

          // 设置关键字段
          newRow["权限id"] = nodeId;
          newRow["权限名称"] = node.权限名称 || node.title || "";
          newRow["权限码"] = node.权限码 || "";
          newRow["权限类型"] = node.权限类型 || "";
          newRow["父级权限id"] = node.父级权限id || "";

          // 设置操作标记
          newRow._action = "新增";

          // 添加到flatData
          console.log(`添加新节点 ${nodeId} 到flatData`);
          newFlat.push(newRow);
          existingIds.add(nodeId); // 添加到已存在集合中，防止后续重复添加
          addedCount++;
        });

        console.log(`成功添加 ${addedCount} 条新增节点记录`);
      }

      // 输出统计信息
      const replacedCount = newFlat.filter(
        (row) => row._action === "替换"
      ).length;
      const deletedCount = newFlat.filter(
        (row) => row._action === "删除"
      ).length;
      const addedCount = newFlat.filter((row) => row._action === "新增").length;

      console.log(
        `处理完成: ${replacedCount}行标记为替换, ${deletedCount}行标记为删除, ${addedCount}行标记为新增`
      );

      setFlatData(newFlat);
    }

    console.log("handleTreeChange 处理结束");
  };

  return (
    <Layout className="layout">
      <Content style={{ padding: "8px 8px" }}>
        <div className="site-layout-content">
          <Row gutter={16} className="horizontal-layout">
            <Col span={6}>
              <JsonUpload
                onChange={handleJsonSubmit}
                onExcelParsed={handleExcelParsed}
              />
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={downloadExcel}
                style={{ marginTop: 16, width: "100%" }}
              >
                下载 excel
              </Button>
            </Col>

            <Col span={18}>
              <TreeDisplay treeData={treeData} onChange={handleTreeChange} />
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
}

export default App;

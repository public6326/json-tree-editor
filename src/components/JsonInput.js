import React from "react";
import { Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

const { Dragger } = Upload;

// 创建一个新的JsonUpload组件，只保留上传功能，移除json输入区域
function JsonUpload({ onChange, onExcelParsed }) {
  // 检查是否为导出后的Excel（包含新增四列）
  const isExportedExcel = (data) => {
    if (!data || !data.length) return false;
    const firstRow = data[0];
    return (
      firstRow.hasOwnProperty("权限名称（新）") &&
      firstRow.hasOwnProperty("父级权限id（新）") &&
      firstRow.hasOwnProperty("权限码（新）") &&
      firstRow.hasOwnProperty("操作")
    );
  };

  // 将 Excel 数据转换为树结构
  const convertToTree = (data) => {
    const isExported = isExportedExcel(data);
    console.log(
      "检测到的Excel类型:",
      isExported ? "导出后的格式(13列)" : "原始格式(9列)"
    );

    const map = {};
    const roots = [];
    const deletedNodes = [];
    const replacedNodes = [];

    // 详细记录操作列的数据，帮助调试
    if (isExported) {
      const operationStats = {
        删除: 0,
        替换: 0,
        修改: 0,
        移动: 0,
        新增: 0,
        其他: 0,
      };

      data.forEach((item) => {
        const op = item["操作"];
        if (!op) return;

        if (op.includes("删除")) operationStats.删除++;
        else if (op.includes("替换")) operationStats.替换++;
        else if (op.includes("修改")) operationStats.修改++;
        else if (op.includes("移动")) operationStats.移动++;
        else if (op.includes("新增")) operationStats.新增++;
        else operationStats.其他++;
      });

      console.log("Excel中的操作统计:", operationStats);
    }

    // 第一轮：创建所有节点
    data.forEach((item) => {
      // 获取节点ID
      const nodeId = item["权限id"];

      // 为节点准备基本数据
      const nodeData = {
        ...item,
        key: nodeId,
        // 优先使用新名称（如果存在）
        title:
          isExported && item["权限名称（新）"]
            ? item["权限名称（新）"]
            : item["权限名称"],
        children: [],
      };

      // 如果是导出的Excel，保留操作信息
      if (isExported && item["操作"]) {
        nodeData["操作"] = item["操作"];
        console.log(`节点 ${nodeId} 操作标记: ${item["操作"]}`);

        // 标记删除节点 - 修改这里，使用includes而不是严格相等
        if (item["操作"].includes("删除")) {
          console.log(`添加节点 ${nodeId} 到已删除列表`);
          deletedNodes.push({
            node: nodeData,
            originParentKey: null, // 暂时不知道原父级
          });
        }
        // 标记替换节点 - 修改这里，使用includes而不是严格相等
        else if (item["操作"].includes("替换")) {
          console.log(`添加节点 ${nodeId} 到已替换列表`);
          replacedNodes.push({
            node: nodeData,
            originParentKey: null,
            originalPermissionId: nodeId,
            originalPermissionCode: item["权限码"],
            parentPermissionCode: item["权限码（新）"] || null,
          });

          // 如果有权限码（新），将其存入父级权限码字段
          if (item["权限码（新）"]) {
            nodeData["父级权限码"] = item["权限码（新）"];
          }
        }
      }

      map[nodeId] = nodeData;
    });

    console.log("第一轮处理完成，创建了", Object.keys(map).length, "个节点");
    console.log("已标记删除节点:", deletedNodes.length);
    console.log("已标记替换节点:", replacedNodes.length);

    // 第二轮：构建父子关系
    data.forEach((item) => {
      const nodeId = item["权限id"];
      const node = map[nodeId];

      // 检查是否为删除或替换节点
      const isMarkedDeleted =
        isExported && item["操作"] && item["操作"].includes("删除");
      const isMarkedReplaced =
        isExported && item["操作"] && item["操作"].includes("替换");

      // 如果是删除或替换节点，不添加到正常的树结构中
      if (isMarkedDeleted || isMarkedReplaced) {
        console.log(
          `跳过节点 ${nodeId} 的父子关系构建，因为它是`,
          isMarkedDeleted ? "删除" : "替换",
          "节点"
        );
        return; // 跳过此节点的父子关系构建
      }

      // 确定父级ID（优先使用新的父级ID）
      let parentId;
      if (isExported && item["父级权限id（新）"]) {
        parentId = item["父级权限id（新）"];
      } else {
        parentId = item["父级权限id"];
      }

      if (parentId && map[parentId]) {
        map[parentId].children.push(map[nodeId]);
      } else {
        roots.push(map[nodeId]);
      }
    });

    console.log("第二轮处理完成，根节点数量:", roots.length);

    // 如果根节点多于1个，添加统一根节点
    let result = [];
    if (roots.length > 1) {
      // 检查是否已存在id=2的节点，避免重复
      const exist2 = data.find(
        (row) => row["权限id"] === 2 || row["权限id"] === "2"
      );
      if (!exist2) {
        // 新增根节点
        const rootNode = {
          权限id: 2,
          权限名称: "菜单权限",
          父级权限id: 0,
          父级权限名称: "",
          key: 2,
          title: "菜单权限",
          children: roots,
        };
        result = [rootNode];
      } else {
        result = [...roots];
      }
    } else {
      result = [...roots];
    }

    // 创建删除和替换节点的特殊根节点
    console.log("准备添加特殊根节点，当前结果节点数:", result.length);

    // 始终添加删除根节点，即使没有删除节点
    if (isExported) {
      console.log("添加已删除根节点，包含", deletedNodes.length, "个节点");
      const deletedRoot = {
        key: "deleted-root",
        title: "已删除",
        children: deletedNodes.map((item) => item.node),
        isSpecialRoot: true,
      };
      result.push(deletedRoot);
      console.log("已添加删除根节点，当前结果节点数:", result.length);
    } else {
      console.log("非导出Excel，不添加删除根节点");
    }

    // 始终添加替换根节点，即使没有替换节点
    if (isExported) {
      console.log("添加已替换根节点，包含", replacedNodes.length, "个节点");
      const replacedRoot = {
        key: "replaced-root",
        title: "已替换",
        children: replacedNodes.map((item) => item.node),
        isSpecialRoot: true,
      };
      result.push(replacedRoot);
      console.log("已添加替换根节点，当前结果节点数:", result.length);
    } else {
      console.log("非导出Excel，不添加替换根节点");
    }

    // 打印最终结果的结构
    console.log("最终树结构:", {
      总节点数: result.length,
      节点类型: result.map((node) => ({
        key: node.key,
        title: node.title,
        子节点数: node.children?.length || 0,
      })),
    });

    return result;
  };

  return (
    <div className="json-upload">
      <h3>上传文件</h3>
      <div className="upload-area">
        <Dragger
          accept=".json,.xlsx,.xls"
          showUploadList={false}
          beforeUpload={(file) => {
            const isExcel =
              file.type ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
              file.type === "application/vnd.ms-excel";
            if (isExcel) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                  defval: "",
                });

                // 检查是否为导出的Excel（含有新增四列）
                const isExported = isExportedExcel(jsonData);

                // 转换为树结构
                const treeData = convertToTree(jsonData);

                // 传递给父组件
                onChange(treeData);

                // 调用 onExcelParsed，保证 flatData/columns 有数据
                if (onExcelParsed && jsonData.length) {
                  const columns = Object.keys(jsonData[0]);
                  // 传递额外参数，表明是导出后的Excel
                  onExcelParsed(jsonData, columns, isExported);
                }

                // 显示不同的成功消息
                if (isExported) {
                  message.success("已导入之前导出的Excel文件，包含操作记录");
                } else {
                  message.success("Excel解析成功，已自动生成树结构");
                }
              };
              reader.readAsArrayBuffer(file);
            } else {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const jsonData = JSON.parse(e.target.result);
                  onChange(jsonData);
                } catch (error) {
                  message.error("无效的 JSON 文件");
                }
              };
              reader.readAsText(file);
            }
            return false;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .json 或 .xlsx 文件</p>
        </Dragger>
      </div>
    </div>
  );
}

export default JsonUpload;
